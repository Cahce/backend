import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '../../../generated/prisma/index.js';
import { MAX_REPLAY_ACTORS, type Anchor, type CommentView, type DiscussionEventSnapshot, type DiscussionRepository,
  type DiscussionTransaction, type MessageView, type ThreadView, type DiscussionEventBatchResult } from '../domain/Ports.js';
import type { ProjectActor } from '../../projects/domain/sharing/Ports.js';
import { accessFor, accessForMany, appendProjectEvent, lockProject } from '../../projects/infra/CollaborationTransaction.js';
import { CollaborationError, requireCondition } from '../../projects/domain/access/CollaborationErrors.js';

type MessageRow = Prisma.ProjectChatMessageGetPayload<{}>;
type CommentRow = Prisma.ProjectCommentGetPayload<{}>;
type ThreadRow = Prisma.ProjectCommentThreadGetPayload<{ include: { file: { select: { path: true; revision: true } } } }>;
const messageView = (m: MessageRow): MessageView => ({ id: m.id, projectId: m.projectId,
  seq: m.creationSeq.toString(), clientMessageId: m.clientMessageId,
  author: { id: m.authorId, displayName: m.authorId ? m.authorLabel : 'Người dùng đã xóa' },
  body: m.deletedAt ? null : m.body, createdAt: m.createdAt.toISOString(), deletedAt: m.deletedAt?.toISOString() ?? null });
const commentView = (c: CommentRow): CommentView => ({ id: c.id, threadId: c.threadId,
  author: { id: c.authorId, displayName: c.authorId ? c.authorLabel : 'Người dùng đã xóa' },
  body: c.deletedAt ? null : c.body, revision: c.revision, clientCommentId: c.clientCommentId,
  createdAt: c.createdAt.toISOString(), deletedAt: c.deletedAt?.toISOString() ?? null });
const threadView = (t: ThreadRow, comments: CommentRow[]): ThreadView => {
  const anchor = t.anchor as Anchor;
  return { id: t.id, projectId: t.projectId, createdById: t.createdById, clientCommentId: t.clientCommentId,
    anchor, anchorStatus: anchor.kind === 'project' ? 'current' : !t.file ? 'file_deleted' :
      anchor.kind === 'range' && t.file.revision !== anchor.baseRevision ? 'stale' : 'current',
    filePath: t.file?.path ?? t.filePathSnapshot, state: t.state, revision: t.revision,
    deletedAt: t.deletedAt?.toISOString() ?? null, updatedAt: t.updatedAt.toISOString(),
    commentsNextCursor: comments.length === 50 ? comments.at(-1)!.id : null,
    comments: comments.map(c => commentView(t.deletedAt ? { ...c, body: null, deletedAt: t.deletedAt } : c)) };
};

export class PrismaDiscussionRepository implements DiscussionRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async readEvents(projectId: string, actor: ProjectActor, since: string, limit: number): Promise<DiscussionEventSnapshot> {
    const [entry] = await this.readEventCohort(projectId, [actor], since, limit, false);
    if ('error' in entry) throw entry.error;
    return entry.snapshot;
  }
  readEventsBatch(projectId: string, actors: readonly ProjectActor[], since: string, limit: number): Promise<DiscussionEventBatchResult[]> {
    requireCondition(actors.length <= MAX_REPLAY_ACTORS, 'VALIDATION_ERROR', 'Nhóm đọc sự kiện quá lớn', 400);
    return this.readEventCohort(projectId, [...new Map(actors.map(actor => [actor.userId, actor])).values()], since, limit, true);
  }
  private readEventCohort(projectId: string, actors: readonly ProjectActor[], since: string, limit: number,
    batchAccess: boolean): Promise<DiscussionEventBatchResult[]> {
    requireCondition(Number.isSafeInteger(limit) && limit > 0 && limit <= 200, 'VALIDATION_ERROR', 'Giới hạn sự kiện không hợp lệ', 400);
    if (!actors.length) return Promise.resolve([]);
    return this.prisma.$transaction(async db => {
      // One committed snapshot keeps the access decision, head and hydrated state aligned,
      // while readers do not contend with the project mutation/revocation row lock.
      await db.$executeRaw`SET TRANSACTION READ ONLY`;
      const accessMap = batchAccess ? await accessForMany(db, projectId, actors) :
        new Map([[actors[0].userId, await accessFor(db, projectId, actors[0])]]);
      const denied = (userId: string): DiscussionEventBatchResult => ({ userId,
        error: new CollaborationError('PROJECT_ACCESS_DENIED', 'Bạn không có quyền đọc thảo luận của dự án', 403) });
      const allowed = actors.filter(actor => accessMap.get(actor.userId)?.canReadChat);
      if (!allowed.length) return actors.map(actor => denied(actor.userId));
      const state = await db.projectCollaborationState.findUnique({ where: { projectId } });
      const highWatermark = (state?.lastEventSeq ?? 0n).toString();
      if (BigInt(since) >= BigInt(highWatermark)) return actors.map(actor => {
        const access = accessMap.get(actor.userId);
        return access?.canReadChat ? { userId: actor.userId, snapshot: { access, highWatermark, events: [] } } : denied(actor.userId);
      });
      const rows = await db.projectEvent.findMany({ where: { projectId, seq: { gt: BigInt(since) } },
        orderBy: { seq: 'asc' }, take: limit });
      const idsFor = (prefix: string) => [...new Set(rows.filter(e => e.type.startsWith(prefix) && e.entityId).map(e => e.entityId!))];
      const messageIds = idsFor('chat.message.');
      const replyIds = idsFor('comment.reply.');
      const messages = new Map((messageIds.length ? await db.projectChatMessage.findMany({
        where: { projectId, id: { in: messageIds } },
      }) : []).map(m => [m.id, messageView(m)]));
      const replies = new Map((replyIds.length ? await db.projectComment.findMany({
        where: { projectId, id: { in: replyIds } },
      }) : []).map(c => [c.id, c]));
      const threadIds = [...new Set([...idsFor('comment.thread.'), ...[...replies.values()].map(c => c.threadId)])];
      const threads = new Map((threadIds.length ? await db.projectCommentThread.findMany({
        where: { projectId, id: { in: threadIds } }, include: { file: { select: { path: true, revision: true } } },
      }) : []).map(t => [t.id, t]));
      // The existing (threadId, createdAt, id) index bounds each lateral lookup to two
      // rows: root content plus evidence that a reply page exists. Never load the full thread.
      const firstComments = threads.size ? await db.$queryRaw<CommentRow[]>(Prisma.sql`
        SELECT c.* FROM "ProjectCommentThread" t
        CROSS JOIN LATERAL (
          SELECT c.* FROM "ProjectComment" c
          WHERE c."threadId" = t.id AND c."projectId" = ${projectId}
          ORDER BY c."createdAt" ASC, c.id ASC LIMIT 2
        ) c
        WHERE t."projectId" = ${projectId} AND t.id IN (${Prisma.join([...threads.keys()])})
        ORDER BY c."threadId", c."createdAt", c.id
      `) : [];
      const roots = new Map<string, CommentRow[]>();
      for (const c of firstComments) {
        const comments = roots.get(c.threadId) ?? [];
        comments.push(c);
        roots.set(c.threadId, comments);
      }
      const compact = (id: string, reply?: CommentRow): ThreadView | null => {
        const t = threads.get(id);
        if (!t) return null;
        const first = roots.get(id) ?? [];
        const comments = [...new Map([...first.slice(0, 1), ...(reply ? [reply] : [])].map(c => [c.id, c])).values()];
        return { ...threadView(t, comments), commentsNextCursor: first.length > 1 ? first[0].id : null };
      };
      const readStates = new Map<string, { lastReadMessageSeq: string; unreadCount: number }>();
      const changedActors = new Set(rows.filter(e => e.type === 'chat.read.changed').map(e => e.actorId));
      const interested = allowed.filter(actor => changedActors.has(actor.userId));
      if (batchAccess && interested.length) {
        // The aggregate remains actor-specific (own messages never count as unread).
        // Only actors represented by a private read-state event need this query.
        const marks = await db.$queryRaw<Array<{ userId: string; lastReadMessageSeq: string; unreadCount: number }>>(Prisma.sql`
          SELECT wanted."userId", COALESCE(r."lastReadMessageSeq", 0)::text AS "lastReadMessageSeq",
            (SELECT count(*)::integer FROM "ProjectChatMessage" m
              WHERE m."projectId" = ${projectId} AND m."deletedAt" IS NULL
                AND m."creationSeq" > COALESCE(r."lastReadMessageSeq", 0)
                AND m."authorId" IS DISTINCT FROM wanted."userId") AS "unreadCount"
          FROM (VALUES ${Prisma.join(interested.map(actor => Prisma.sql`(${actor.userId}::text)`))}) wanted("userId")
          LEFT JOIN "ProjectChatReadState" r ON r."projectId" = ${projectId} AND r."userId" = wanted."userId"
        `);
        for (const mark of marks) readStates.set(mark.userId, { lastReadMessageSeq: mark.lastReadMessageSeq, unreadCount: mark.unreadCount });
      } else if (!batchAccess && interested.length) {
        const actor = interested[0];
        const mark = await db.projectChatReadState.findUnique({ where: { projectId_userId: { projectId, userId: actor.userId } } });
        const lastRead = mark?.lastReadMessageSeq ?? 0n;
        readStates.set(actor.userId, { lastReadMessageSeq: lastRead.toString(), unreadCount: await db.projectChatMessage.count({
          where: { projectId, deletedAt: null, creationSeq: { gt: lastRead },
            OR: [{ authorId: null }, { authorId: { not: actor.userId } }] },
        }) });
      }
      const publicData = rows.map(e => {
        let data: unknown = e.metadata;
        if (e.type.startsWith('chat.message.') && e.entityId) data = { message: messages.get(e.entityId) ?? null };
        if (e.type.startsWith('comment.thread.') && e.entityId) data = { thread: compact(e.entityId) };
        if (e.type.startsWith('comment.reply.') && e.entityId) {
          const c = replies.get(e.entityId);
          const thread = c ? compact(c.threadId, c) : null;
          data = { thread, comment: c ? commentView(thread?.deletedAt ? { ...c, body: null, deletedAt: new Date(thread.deletedAt) } : c) : null };
        }
        return data;
      });
      return actors.map(actor => {
        const access = accessMap.get(actor.userId);
        if (!access?.canReadChat) return denied(actor.userId);
        const events = rows.map((e, index) => ({ type: e.type, projectId, seq: e.seq.toString(), accessVersion: access.version,
          occurredAt: e.createdAt.toISOString(), data: e.type === 'chat.read.changed' ?
            e.actorId === actor.userId ? readStates.get(actor.userId) : {} : publicData[index] }));
        return { userId: actor.userId, snapshot: { access, highWatermark, events } };
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 10_000, timeout: 15_000 });
  }
  run<T>(projectId: string, actor: ProjectActor, work: (tx: DiscussionTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async db => {
      await lockProject(db, projectId);
      const access = await accessFor(db, projectId, actor);
      requireCondition(access.canReadChat, 'PROJECT_ACCESS_DENIED', 'Bạn không có quyền đọc thảo luận của dự án');
      const user = await db.user.findUnique({ where: { id: actor.userId }, include: { student: true, teacher: true } });
      const authorLabel = user?.student?.fullName ?? user?.teacher?.fullName ?? 'Thành viên';
      const emit = (type: string, id: string | null) => appendProjectEvent(db, projectId, type, id, actor.userId);
      const scopedMessage = async (id: string) => {
        const m = await db.projectChatMessage.findFirst({ where: { id, projectId } });
        return m ? messageView(m) : null;
      };
      const scopedComment = async (id: string) => {
        const c = await db.projectComment.findFirst({ where: { id, projectId } });
        return c ? commentView(c) : null;
      };
      const scopedThread = async (id: string): Promise<ThreadView | null> => {
        const t = await db.projectCommentThread.findFirst({ where: { id, projectId },
          include: { file: true, comments: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 50 } } });
        if (!t) return null;
        return threadView(t, t.comments);
      };
      const session: DiscussionTransaction = {
        access,
        head: async () => (await db.projectCollaborationState.findUniqueOrThrow({ where: { projectId } })).lastEventSeq.toString(),
        history: async (before, limit) => (await db.projectChatMessage.findMany({ where: { projectId,
          ...(before ? { creationSeq: { lt: BigInt(before) } } : {}) }, orderBy: { creationSeq: 'desc' }, take: limit })).map(messageView),
        message: scopedMessage,
        findSent: async clientMessageId => {
          const m = await db.projectChatMessage.findFirst({ where: { projectId, authorId: actor.userId, clientMessageId } });
          return m ? messageView(m) : null;
        },
        send: async (clientMessageId, body) => {
          const id = randomUUID();
          const seq = await emit('chat.message.created', id);
          return messageView(await db.projectChatMessage.create({ data: { id, projectId, authorId: actor.userId,
            authorLabel, clientMessageId, body, creationSeq: seq } }));
        },
        deleteMessage: async id => {
          await db.projectChatMessage.update({ where: { id, projectId }, data: { body: null, deletedAt: new Date() } });
          await emit('chat.message.deleted', id);
        },
        readState: async seq => {
          let mark = await db.projectChatReadState.findUnique({ where: { projectId_userId: { projectId, userId: actor.userId } } });
          if (seq && BigInt(seq) > (mark?.lastReadMessageSeq ?? 0n)) {
            mark = await db.projectChatReadState.upsert({ where: { projectId_userId: { projectId, userId: actor.userId } },
              create: { projectId, userId: actor.userId, lastReadMessageSeq: BigInt(seq) }, update: { lastReadMessageSeq: BigInt(seq) } });
            await emit('chat.read.changed', actor.userId);
          }
          const unreadCount = await db.projectChatMessage.count({ where: { projectId, deletedAt: null,
            creationSeq: { gt: mark?.lastReadMessageSeq ?? 0n }, OR: [{ authorId: null }, { authorId: { not: actor.userId } }] } });
          return { lastReadMessageSeq: (mark?.lastReadMessageSeq ?? 0n).toString(), unreadCount };
        },
        file: async id => {
          const f = await db.file.findFirst({ where: { id, projectId } });
          return f ? { id: f.id, path: f.path, revision: f.revision, content: f.textContent } : null;
        },
        threads: async (before, limit = 25) => {
          const cursor = before ? await db.projectCommentThread.findFirst({ where: { id: before, projectId } }) : null;
          requireCondition(!before || cursor, 'INVALID_CURSOR', 'Mốc nhận xét không hợp lệ', 400);
          const rows = await db.projectCommentThread.findMany({ where: { projectId,
            ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}) },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit });
          const result: ThreadView[] = []; for (const t of rows) { const mapped = await scopedThread(t.id); if (mapped) result.push(mapped); } return result;
        },
        comments: async (threadId, after, limit = 50) => {
          const cursor = after ? await db.projectComment.findFirst({ where: { projectId, threadId, id: after } }) : null;
          requireCondition(!after || cursor, 'INVALID_CURSOR', 'Mốc trả lời không hợp lệ', 400);
          return (await db.projectComment.findMany({ where: { projectId, threadId,
            ...(cursor ? { OR: [{ createdAt: { gt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { gt: cursor.id } }] } : {}) },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: limit })).map(commentView);
        },
        thread: scopedThread,
        findCreatedThread: async clientCommentId => {
          const t = await db.projectCommentThread.findFirst({ where: { projectId, createdById: actor.userId, clientCommentId } });
          return t ? scopedThread(t.id) : null;
        },
        findReply: async (threadId, clientCommentId) => {
          const c = await db.projectComment.findFirst({ where: { projectId, threadId, authorId: actor.userId, clientCommentId } });
          return c ? commentView(c) : null;
        },
        createThread: async (clientCommentId, body, anchor, filePathSnapshot) => {
          const id = randomUUID();
          await db.projectCommentThread.create({ data: { id, projectId, createdById: actor.userId, clientCommentId,
            anchor: anchor as Prisma.InputJsonValue, filePathSnapshot, fileId: anchor.kind === 'project' ? null : anchor.fileId } });
          await db.projectComment.create({ data: { projectId, threadId: id, authorId: actor.userId, authorLabel, clientCommentId, body } });
          await emit('comment.thread.created', id);
          return (await scopedThread(id))!;
        },
        addComment: async (threadId, clientCommentId, body) => {
          const c = await db.projectComment.create({ data: { projectId, threadId, authorId: actor.userId, authorLabel, clientCommentId, body } });
          await db.projectCommentThread.update({ where: { id: threadId, projectId }, data: { updatedAt: new Date(), revision: { increment: 1 } } });
          await emit('comment.reply.created', c.id);
          return commentView(c);
        },
        comment: scopedComment,
        updateComment: async (id, body) => {
          const c = await db.projectComment.update({ where: { id, projectId }, data: {
            body, revision: { increment: 1 }, editedAt: new Date(), ...(body === null ? { deletedAt: new Date() } : {}) } });
          await db.projectCommentThread.update({ where: { id: c.threadId, projectId }, data: { updatedAt: new Date(), revision: { increment: 1 } } });
          await emit(body === null ? 'comment.reply.deleted' : 'comment.reply.updated', id);
          return commentView(c);
        },
        updateThread: async (id, state, deleted) => {
          await db.projectCommentThread.update({ where: { id, projectId }, data: {
            ...(state ? { state } : {}), ...(deleted ? { deletedAt: new Date(), anchor: { kind: 'project' }, fileId: null, filePathSnapshot: null } : {}), revision: { increment: 1 } } });
          if (deleted) await db.projectComment.updateMany({ where: { threadId: id, projectId }, data: { body: null, deletedAt: new Date() } });
          await emit(deleted ? 'comment.thread.deleted' : 'comment.thread.updated', id);
          return (await scopedThread(id))!;
        },
      };
      return work(session);
    }, { maxWait: 10_000, timeout: 15_000 });
  }
}
