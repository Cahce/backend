import { MAX_REPLAY_ACTORS, type Anchor, type DiscussionRepository, type DiscussionTransaction,
  type DiscussionEventSnapshot, type DiscussionEventPage, type DiscussionEventPageResult } from '../domain/Ports.js';
import type { ProjectActor } from '../../projects/domain/sharing/Ports.js';
import { requireCondition } from '../../projects/domain/access/CollaborationErrors.js';

export class ProjectDiscussionUseCases {
  constructor(private readonly repo: DiscussionRepository) {}
  run<T>(projectId: string, actor: ProjectActor, action: (tx: DiscussionTransaction) => Promise<T>) {
    return this.repo.run(projectId, actor, async tx => {
      requireCondition(tx.access.canReadChat, 'PROJECT_ACCESS_DENIED', 'Bạn không có quyền đọc thảo luận của dự án');
      return action(tx);
    });
  }
  history(projectId: string, actor: ProjectActor, before?: string, limit = 50) {
    return this.run(projectId, actor, async tx => {
      const messages = await tx.history(before, limit);
      return { messages, nextCursor: messages.length === limit ? messages.at(-1)!.seq : null, highWatermark: await tx.head() };
    });
  }
  send(projectId: string, actor: ProjectActor, clientId: string, body: string) {
    return this.run(projectId, actor, async tx => {
      requireCondition(tx.access.canSendChat, 'PROJECT_ACCESS_DENIED', 'Bạn không có quyền gửi tin nhắn');
      const existing = await tx.findSent(clientId);
      if (existing) {
        requireCondition(existing.deletedAt || existing.body === body, 'IDEMPOTENCY_KEY_REUSED', 'Mã gửi đã dùng cho nội dung khác', 409);
        return { message: existing, created: false };
      }
      return { message: await tx.send(clientId, body), created: true };
    });
  }
  deleteMessage(projectId: string, actor: ProjectActor, id: string) {
    return this.run(projectId, actor, async tx => {
      const message = await tx.message(id);
      requireCondition(message, 'MESSAGE_NOT_FOUND', 'Không tìm thấy tin nhắn', 404);
      requireCondition(tx.access.canModerateDiscussion || message.author.id === actor.userId,
        'FORBIDDEN', 'Bạn chỉ được xóa tin nhắn của mình');
      if (!message.deletedAt) await tx.deleteMessage(id);
    });
  }
  readState(projectId: string, actor: ProjectActor, seq?: string) {
    return this.run(projectId, actor, async tx => {
      if (seq) requireCondition(BigInt(seq) <= BigInt(await tx.head()), 'VALIDATION_ERROR', 'Mốc đã đọc không hợp lệ', 400);
      return tx.readState(seq);
    });
  }
  threads(projectId: string, actor: ProjectActor, before?: string, limit = 25) {
    return this.run(projectId, actor, async tx => { const threads = await tx.threads(before, limit);
      return { threads, highWatermark: await tx.head(), nextCursor: threads.length === limit ? threads.at(-1)!.id : null }; });
  }
  comments(projectId: string, actor: ProjectActor, threadId: string, after?: string, limit = 50) {
    return this.run(projectId, actor, async tx => {
      const thread = await tx.thread(threadId); requireCondition(thread && !thread.deletedAt, 'THREAD_NOT_FOUND', 'Không tìm thấy nhận xét', 404);
      const comments = await tx.comments(threadId, after, limit);
      return { comments, nextCursor: comments.length === limit ? comments.at(-1)!.id : null };
    });
  }
  createThread(projectId: string, actor: ProjectActor, clientId: string, body: string, anchor: Anchor) {
    return this.run(projectId, actor, async tx => {
      requireCondition(tx.access.canComment, 'COMMENT_FORBIDDEN', 'Bạn không có quyền để lại nhận xét');
      const existing = await tx.findCreatedThread(clientId);
      if (existing) {
        const old = existing.anchor;
        const sameAnchor = old.kind === anchor.kind && (old.kind === 'project' || (anchor.kind !== 'project' && old.fileId === anchor.fileId &&
          (old.kind !== 'range' || (anchor.kind === 'range' && old.baseRevision === anchor.baseRevision && old.from === anchor.from && old.to === anchor.to && old.quote === anchor.quote))));
        requireCondition(existing.deletedAt || (existing.comments[0]?.body === body && sameAnchor), 'IDEMPOTENCY_KEY_REUSED', 'Mã nhận xét đã được sử dụng', 409);
        return existing;
      }
      let filePath: string | null = null;
      if (anchor.kind !== 'project') {
        const file = await tx.file(anchor.fileId);
        requireCondition(file, 'FILE_NOT_FOUND', 'Không tìm thấy tệp trong dự án', 404);
        filePath = file.path;
        if (anchor.kind === 'range') {
          requireCondition(file.revision === anchor.baseRevision, 'COMMENT_ANCHOR_STALE', 'Tệp đã thay đổi. Hãy chọn lại đoạn nhận xét', 409);
          requireCondition(file.content !== null && anchor.from >= 0 && anchor.to > anchor.from &&
            anchor.to <= file.content.length && file.content.slice(anchor.from, anchor.to) === anchor.quote,
            'VALIDATION_ERROR', 'Đoạn trích nhận xét không khớp nội dung đã lưu', 400);
          const splitsSurrogate = (offset: number) => offset > 0 && offset < file.content!.length &&
            file.content!.charCodeAt(offset - 1) >= 0xd800 && file.content!.charCodeAt(offset - 1) <= 0xdbff &&
            file.content!.charCodeAt(offset) >= 0xdc00 && file.content!.charCodeAt(offset) <= 0xdfff;
          requireCondition(!splitsSurrogate(anchor.from) && !splitsSurrogate(anchor.to), 'VALIDATION_ERROR', 'Không được tách đôi ký tự Unicode', 400);
        }
      }
      return tx.createThread(clientId, body, anchor, filePath);
    });
  }
  reply(projectId: string, actor: ProjectActor, threadId: string, clientId: string, body: string) {
    return this.run(projectId, actor, async tx => {
      requireCondition(tx.access.canComment, 'COMMENT_FORBIDDEN', 'Bạn không có quyền trả lời nhận xét');
      const thread = await tx.thread(threadId);
      requireCondition(thread && !thread.deletedAt, 'THREAD_NOT_FOUND', 'Không tìm thấy nhận xét', 404);
      const existing = await tx.findReply(threadId, clientId);
      if (existing) {
        requireCondition(existing.deletedAt || existing.body === body, 'IDEMPOTENCY_KEY_REUSED', 'Mã nhận xét đã được sử dụng', 409);
        return existing;
      }
      requireCondition(thread.state === 'open', 'THREAD_RESOLVED', 'Nhận xét đã xử lý. Hãy mở lại trước khi trả lời', 409);
      return tx.addComment(threadId, clientId, body);
    });
  }
  changeThread(projectId: string, actor: ProjectActor, id: string, baseRevision: number, state?: 'open' | 'resolved', deleted = false) {
    return this.run(projectId, actor, async tx => {
      const thread = await tx.thread(id);
      requireCondition(thread, 'THREAD_NOT_FOUND', 'Không tìm thấy nhận xét', 404);
      requireCondition(tx.access.canModerateDiscussion || (tx.access.canComment &&
        (thread.createdById === actor.userId || (!deleted && tx.access.level === 'editor'))), 'COMMENT_FORBIDDEN', 'Bạn không có quyền xử lý nhận xét này');
      if (thread.deletedAt && deleted) return thread;
      requireCondition(!thread.deletedAt && thread.revision === baseRevision, 'COMMENT_VERSION_CONFLICT', 'Nhận xét đã thay đổi. Hãy tải lại', 409);
      return tx.updateThread(id, state, deleted);
    });
  }
  changeComment(projectId: string, actor: ProjectActor, id: string, baseRevision: number, body: string | null) {
    return this.run(projectId, actor, async tx => {
      const comment = await tx.comment(id);
      requireCondition(comment, 'COMMENT_NOT_FOUND', 'Không tìm thấy phản hồi', 404);
      const thread = await tx.thread(comment.threadId);
      requireCondition(thread && !thread.deletedAt, 'THREAD_NOT_FOUND', 'Không tìm thấy nhận xét', 404);
      requireCondition(tx.access.canComment && (comment.author.id === actor.userId || tx.access.canModerateDiscussion),
        'COMMENT_FORBIDDEN', 'Bạn chỉ được sửa/xóa nhận xét của mình');
      if (comment.deletedAt && body === null) return comment;
      requireCondition(!comment.deletedAt && comment.revision === baseRevision, 'COMMENT_VERSION_CONFLICT', 'Nhận xét đã thay đổi. Hãy tải lại', 409);
      return tx.updateComment(id, body);
    });
  }
  async events(projectId: string, actor: ProjectActor, since: string, limit = 100) {
    return this.eventPage(await this.repo.readEvents(projectId, actor, since, limit), since, limit);
  }
  async eventsBatch(projectId: string, actors: readonly ProjectActor[], since: string, limit = 100): Promise<DiscussionEventPageResult[]> {
    requireCondition(actors.length <= MAX_REPLAY_ACTORS, 'VALIDATION_ERROR', 'Nhóm đọc sự kiện quá lớn', 400);
    const distinct = [...new Map(actors.map(actor => [actor.userId, actor])).values()];
    if (!distinct.length) return [];
    const snapshots = this.repo.readEventsBatch ? await this.repo.readEventsBatch(projectId, distinct, since, limit) :
      await Promise.all(distinct.map(async actor => {
        try { return { userId: actor.userId, snapshot: await this.repo.readEvents(projectId, actor, since, limit) }; }
        catch (error) { return { userId: actor.userId, error: error instanceof Error ? error : new Error('Replay unavailable') }; }
      }));
    return snapshots.map(entry => {
      if ('error' in entry) return entry;
      try { return { userId: entry.userId, result: this.eventPage(entry.snapshot, since, limit) }; }
      catch (error) { return { userId: entry.userId, error: error instanceof Error ? error : new Error('Replay unavailable') }; }
    });
  }
  private eventPage({ access, highWatermark, events }: DiscussionEventSnapshot, since: string, limit: number): DiscussionEventPage {
    requireCondition(access.canReadChat, 'PROJECT_ACCESS_DENIED', 'Bạn không có quyền đọc thảo luận của dự án');
    requireCondition(BigInt(since) <= BigInt(highWatermark), 'INVALID_CURSOR', 'Mốc sự kiện không hợp lệ', 400);
    return { events, nextCursor: events.length === limit ? events.at(-1)!.seq : highWatermark,
      highWatermark, hasMore: events.length === limit };
  }
}
