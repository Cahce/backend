import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma, type PrismaClient } from '../../../generated/prisma/index.js';
import { ProjectDiscussionUseCases } from '../application/ProjectDiscussionUseCases.js';
import { PrismaDiscussionRepository } from '../infra/PrismaDiscussionRepository.js';
import type { CommentView, MessageView, ThreadView, DiscussionEventPageResult } from '../domain/Ports.js';

type EventRow = Prisma.ProjectEventGetPayload<{}>;
type MessageRow = Prisma.ProjectChatMessageGetPayload<{}>;
type CommentRow = Prisma.ProjectCommentGetPayload<{}>;
type ThreadRow = Prisma.ProjectCommentThreadGetPayload<{ include: { file: { select: { path: true; revision: true } } } }>;
const timestamp = new Date('2026-10-03T10:00:00Z');
const owner = { userId: 'owner', role: 'student' as const };
const event = (seq: number, type: string, entityId: string | null, actorId = 'owner'): EventRow => ({
  projectId: 'project', seq: BigInt(seq), type, entityId, actorId, metadata: {}, createdAt: timestamp, dispatchedAt: null,
});
const message = (id: string, seq = 1): MessageRow => ({ id, projectId: 'project', authorId: 'owner',
  authorLabel: 'Owner', clientMessageId: id, creationSeq: BigInt(seq), body: `message ${id}`, createdAt: timestamp, deletedAt: null });
const comment = (id: string, threadId: string): CommentRow => ({ id, projectId: 'project', threadId, authorId: 'owner',
  authorLabel: 'Owner', clientCommentId: id, body: `comment ${id}`, revision: 1, createdAt: timestamp, editedAt: null, deletedAt: null });
const thread = (id: string): ThreadRow => ({ id, projectId: 'project', clientCommentId: id, fileId: null, file: null,
  filePathSnapshot: null, anchor: { kind: 'project' }, createdById: 'owner', state: 'open', revision: 1,
  createdAt: timestamp, updatedAt: timestamp, deletedAt: null });

function fixture(options: {
  events?: EventRow[]; messages?: MessageRow[]; comments?: CommentRow[]; threads?: ThreadRow[];
  state?: { lastEventSeq: bigint; accessVersion: bigint } | null;
  users?: Record<string, { isActive: boolean; mustChangePassword: boolean; role: 'admin' | 'student' }>;
  blocked?: string[];
} = {}) {
  const calls: Array<{ method: string; args: unknown }> = [];
  const record = (method: string, args: unknown) => { calls.push({ method, args }); };
  const scoped = <T extends { id: string; projectId: string }>(rows: T[], args: { where: { projectId: string; id: { in: string[] } } }) => {
    assert.equal(args.where.projectId, 'project');
    return rows.filter(row => row.projectId === args.where.projectId && args.where.id.in.includes(row.id));
  };
  const state = options.state === undefined ? { lastEventSeq: 1000n, accessVersion: 7n } : options.state;
  const db = {
    $executeRaw: async (strings: TemplateStringsArray) => {
      record('execute', strings.join(''));
      assert.equal(strings.join(''), 'SET TRANSACTION READ ONLY');
      return 0;
    },
    $queryRaw: async (query: Prisma.Sql) => {
      if (query.sql.includes('FROM "Project" p')) {
        record('accessFacts', query);
        if (query.sql.includes('wanted."userId"')) {
          assert.equal(query.values.at(-1), 'project');
          assert.match(query.sql, /g\."memberId" = m\.id AND g\."projectId" = p\.id/);
          assert.match(query.sql, /l\."projectId" = p\.id/);
          return query.values.slice(0, -1).map(value => {
            const userId = String(value);
            return { userId, ownerId: 'owner', ...(options.users?.[userId] ?? { isActive: true, mustChangePassword: false, role: 'student' }),
              version: String(state?.accessVersion ?? 1n), memberStatus: options.blocked?.includes(userId) ? 'blocked' : 'active',
              roleOverride: 'viewer', grants: [] };
          });
        }
        const userId = String(query.values[0]);
        assert.equal(query.values[1], userId);
        assert.equal(query.values[2], 'project');
        return [{ ownerId: 'owner', ...(options.users?.[userId] ?? { isActive: true, mustChangePassword: false, role: 'student' }),
          version: String(state?.accessVersion ?? 1n), memberStatus: options.blocked?.includes(userId) ? 'blocked' : 'active',
          roleOverride: 'viewer', grants: [] }];
      }
      if (query.sql.includes('"ProjectChatReadState"')) {
        record('privateMarks', query);
        assert.equal(query.values[0], 'project'); assert.equal(query.values.at(-1), 'project');
        assert.match(query.sql, /m\."deletedAt" IS NULL/);
        assert.match(query.sql, /m\."authorId" IS DISTINCT FROM wanted\."userId"/);
        return query.values.slice(1, -1).map(userId => ({ userId, lastReadMessageSeq: userId === 'owner' ? '10' : '20',
          unreadCount: userId === 'owner' ? 90 : 80 }));
      }
      record('roots', query);
      assert.match(query.sql, /CROSS JOIN LATERAL/);
      assert.match(query.sql, /LIMIT 2/);
      assert.match(query.sql, /c\."projectId" = \?/);
      assert.match(query.sql, /t\."projectId" = \?/);
      assert.equal(query.values[0], 'project');
      assert.equal(query.values[1], 'project');
      return query.values.slice(2).flatMap(id => (options.comments ?? []).filter(c =>
        c.projectId === 'project' && c.threadId === id).sort((a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)).slice(0, 2));
    },
    project: { findUnique: async (args: unknown) => { record('project', args); return { ownerId: 'owner' }; } },
    user: { findUnique: async (args: { where: { id: string } }) => {
      record('user', args);
      return options.users?.[args.where.id] ?? { isActive: true, mustChangePassword: false, role: 'student' };
    } },
    projectMember: { findUnique: async (args: { where: { projectId_userId: { userId: string } } }) => {
      record('member', args);
      return { status: options.blocked?.includes(args.where.projectId_userId.userId) ? 'blocked' : 'active',
        roleOverride: 'viewer', grants: [] };
    } },
    projectCollaborationState: { findUnique: async (args: unknown) => { record('state', args); return state; } },
    projectEvent: { findMany: async (args: { where: { projectId: string; seq: { gt: bigint } }; take: number }) => {
      record('events', args);
      assert.equal(args.where.projectId, 'project');
      return (options.events ?? []).filter(e => e.projectId === args.where.projectId && e.seq > args.where.seq.gt)
        .sort((a, b) => Number(a.seq - b.seq)).slice(0, args.take);
    } },
    projectChatMessage: {
      findMany: async (args: { where: { projectId: string; id: { in: string[] } } }) => {
        record('messages', args); return scoped(options.messages ?? [], args);
      },
      count: async (args: { where: { projectId: string; creationSeq: { gt: bigint }; OR: unknown } }) => {
        record('unread', args); assert.equal(args.where.projectId, 'project'); return Number(100n - args.where.creationSeq.gt);
      },
    },
    projectComment: { findMany: async (args: { where: { projectId: string; id: { in: string[] } } }) => {
      record('replies', args); return scoped(options.comments ?? [], args);
    } },
    projectCommentThread: { findMany: async (args: { where: { projectId: string; id: { in: string[] } }; include: unknown }) => {
      record('threads', args);
      assert.deepEqual(args.include, { file: { select: { path: true, revision: true } } });
      return scoped(options.threads ?? [], args);
    } },
    projectChatReadState: { findUnique: async (args: { where: { projectId_userId: { projectId: string; userId: string } } }) => {
      record('mark', args);
      assert.equal(args.where.projectId_userId.projectId, 'project');
      return { lastReadMessageSeq: args.where.projectId_userId.userId === 'owner' ? 10n : 20n };
    } },
  };
  const prisma = { $transaction: async (work: (client: typeof db) => Promise<unknown>, args: unknown) => {
    record('transaction', args);
    assert.deepEqual(args, { isolationLevel: 'RepeatableRead', maxWait: 10_000, timeout: 15_000 });
    return work(db);
  } } as unknown as PrismaClient;
  const repository = new PrismaDiscussionRepository(prisma);
  // A replay that regresses to the mutation path must fail even if the fake DB supports its reads.
  repository.run = async () => { throw new Error('Replay must not acquire a mutation session'); };
  return { uc: new ProjectDiscussionUseCases(repository), repository, calls,
    count: (name: string) => calls.filter(c => c.method === name).length };
}

test('replay batches 200 mixed events using the same bounded repository calls as four events', async () => {
  const callsFor = async (groups: number) => {
    const events: EventRow[] = [], messages: MessageRow[] = [], comments: CommentRow[] = [], threads: ThreadRow[] = [];
    for (let i = 0; i < groups; i++) {
      events.push(event(i * 4 + 1, 'chat.message.created', `m${i}`), event(i * 4 + 2, 'comment.thread.created', `t${i}`),
        event(i * 4 + 3, 'comment.reply.created', `reply${i}`), event(i * 4 + 4, 'chat.read.changed', 'owner'));
      messages.push(message(`m${i}`)); threads.push(thread(`t${i}`)); comments.push(comment(`reply${i}`, `t${i}`));
    }
    const f = fixture({ events, messages, comments, threads });
    const page = await f.uc.events('project', owner, '0', 200);
    assert.equal(page.events.length, groups * 4);
    for (const method of ['messages', 'replies', 'threads', 'roots', 'mark', 'unread', 'accessFacts']) assert.equal(f.count(method), 1, method);
    return f.calls.length;
  };
  assert.equal(await callsFor(50), await callsFor(1));
});

function pageFor(results: DiscussionEventPageResult[], userId: string) {
  const entry = results.find(result => result.userId === userId);
  assert(entry && 'result' in entry, `Expected an allowed page for ${userId}`);
  return entry.result;
}

test('a frozen 50-actor cohort hydrates a mixed page once and projects private read-state per actor', async () => {
  const f = fixture({ events: [event(1, 'chat.message.created', 'm'), event(2, 'comment.thread.created', 't'),
    event(3, 'comment.reply.created', 'c'), event(4, 'chat.read.changed', 'owner'),
    event(5, 'chat.read.changed', 'viewer', 'viewer')], messages: [message('m')], threads: [thread('t')], comments: [comment('c', 't')] });
  const actors = [owner, ...Array.from({ length: 49 }, (_, i) => ({ userId: i ? `viewer${i}` : 'viewer', role: 'student' as const }))];
  const results = await f.uc.eventsBatch('project', actors, '0');
  assert.equal(results.length, 50);
  for (const method of ['transaction', 'accessFacts', 'state', 'events', 'messages', 'replies', 'threads', 'roots', 'privateMarks'])
    assert.equal(f.count(method), 1, method);
  assert.equal(f.count('mark'), 0); assert.equal(f.count('unread'), 0);
  const a = pageFor(results, 'owner'), b = pageFor(results, 'viewer'), c = pageFor(results, 'viewer1');
  assert.deepEqual(a.events.slice(3).map(e => e.data), [{ lastReadMessageSeq: '10', unreadCount: 90 }, {}]);
  assert.deepEqual(b.events.slice(3).map(e => e.data), [{}, { lastReadMessageSeq: '20', unreadCount: 80 }]);
  assert.deepEqual(c.events.slice(3).map(e => e.data), [{}, {}]);
  assert.notStrictEqual(a.events, b.events); assert.notStrictEqual(a.events[0], b.events[0]);
  assert(a.events.every(e => e.accessVersion === '7'));
  assert.deepEqual(a.events.map(e => e.seq), ['1', '2', '3', '4', '5']);
});

test('one denied recipient does not poison cohort peers and all-denied cohorts skip payload reads', async () => {
  const f = fixture({ events: [event(1, 'chat.message.created', 'm')], messages: [message('m')], blocked: ['blocked'],
    users: { inactive: { isActive: false, mustChangePassword: false, role: 'student' },
      reset: { isActive: true, mustChangePassword: true, role: 'student' } } });
  const actors = [owner, ...['blocked', 'inactive', 'reset'].map(userId => ({ userId, role: 'admin' as const }))];
  const results = await f.uc.eventsBatch('project', actors, '0');
  assert.equal(pageFor(results, 'owner').events.length, 1);
  for (const entry of results.slice(1)) { assert('error' in entry); assert.equal((entry.error as Error & { code: string }).code, 'PROJECT_ACCESS_DENIED'); }
  await f.uc.eventsBatch('project', actors.slice(1), '0');
  assert.equal(f.count('accessFacts'), 2); assert.equal(f.count('events'), 1); assert.equal(f.count('state'), 1);
});

test('cohort input is bounded before queries and duplicate actor tabs share a single projection', async () => {
  const f = fixture();
  assert.deepEqual(await f.uc.eventsBatch('project', [], '0'), []);
  const results = await f.uc.eventsBatch('project', [owner, owner], '1000');
  assert.equal(results.length, 1); assert.equal(f.count('accessFacts'), 1);
  const tooMany = Array.from({ length: 51 }, () => owner);
  await assert.rejects(f.uc.eventsBatch('project', tooMany, '0'), { code: 'VALIDATION_ERROR' });
  assert.throws(() => f.repository.readEventsBatch('project', tooMany, '0', 100), { code: 'VALIDATION_ERROR' });
  assert.equal(f.count('transaction'), 1);
  await assert.rejects(f.uc.eventsBatch('project', [owner], '0', 201), { code: 'VALIDATION_ERROR' });
  assert.equal(f.count('transaction'), 1);
});

test('cohorts never reuse fulfilled snapshots across deletion, account changes or future cursors', async () => {
  const stored = message('m'), users = { owner: { isActive: true, mustChangePassword: false, role: 'student' as const } };
  const f = fixture({ events: [event(1, 'chat.message.created', 'm')], messages: [stored], users });
  const first = pageFor(await f.uc.eventsBatch('project', [owner], '0'), 'owner');
  assert.equal((first.events[0].data as { message: MessageView }).message.body, 'message m');
  stored.deletedAt = timestamp;
  const second = pageFor(await f.uc.eventsBatch('project', [owner], '0'), 'owner');
  assert.equal((second.events[0].data as { message: MessageView }).message.body, null);
  assert.equal((first.events[0].data as { message: MessageView }).message.body, 'message m');
  users.owner.isActive = false;
  const [denied] = await f.uc.eventsBatch('project', [owner], '0');
  assert('error' in denied); assert.equal(f.count('accessFacts'), 3); assert.equal(f.count('messages'), 2);
  users.owner.isActive = true;
  const [ahead] = await f.uc.eventsBatch('project', [owner], '1001');
  assert('error' in ahead); assert.equal((ahead.error as Error & { code: string }).code, 'INVALID_CURSOR');
});

test('foreign read-state events neither load private marks nor disappear from a cohort cursor', async () => {
  const f = fixture({ events: [event(1, 'chat.read.changed', 'other', 'other')], state: { lastEventSeq: 1n, accessVersion: 8n } });
  const results = await f.uc.eventsBatch('project', [owner, { userId: 'viewer', role: 'student' }], '0');
  for (const entry of results) {
    assert('result' in entry); assert.deepEqual(entry.result.events[0].data, {}); assert.equal(entry.result.nextCursor, '1');
  }
  assert.equal(f.count('privateMarks'), 0); assert.equal(f.count('mark'), 0); assert.equal(f.count('unread'), 0);
});

test('replay keeps the root/cursor and a changed reply beyond the initial page with current thread state', async () => {
  const root = comment('001', 't'), second = comment('002', 't'), tail = { ...comment('100', 't'), revision: 9 };
  const f = fixture({ events: [event(1, 'comment.thread.created', 't'), event(2, 'comment.reply.updated', '100')],
    comments: [root, second, tail], threads: [{ ...thread('t'), revision: 12, state: 'resolved',
      anchor: { kind: 'range', fileId: 'file', baseRevision: 1, from: 0, to: 1, quote: 'x' },
      file: { path: 'renamed.typ', revision: 2 }, fileId: 'file' }] });
  const page = await f.uc.events('project', owner, '0');
  const first = page.events[0].data as { thread: ThreadView };
  const updated = page.events[1].data as { thread: ThreadView; comment: CommentView };
  assert.deepEqual(first.thread.comments.map(c => c.id), ['001']);
  assert.equal(first.thread.commentsNextCursor, '001');
  assert.deepEqual(updated.thread.comments.map(c => c.id), ['001', '100']);
  assert.equal(updated.comment.revision, 9);
  assert.equal(updated.thread.commentsNextCursor, '001');
  assert.equal(updated.thread.revision, 12);
  assert.equal(updated.thread.state, 'resolved');
  assert.equal(updated.thread.anchorStatus, 'stale');
  assert.equal(updated.thread.filePath, 'renamed.typ');
});

test('replay redacts tombstones and uses a file-deleted anchor without reviving old content', async () => {
  const f = fixture({ events: [event(1, 'chat.message.created', 'm'), event(2, 'comment.reply.created', 'c'),
    event(3, 'comment.thread.created', 'missing-file')],
  messages: [{ ...message('m'), authorId: null, deletedAt: timestamp }],
  comments: [comment('c', 'deleted')], threads: [{ ...thread('deleted'), deletedAt: timestamp },
    { ...thread('missing-file'), anchor: { kind: 'file', fileId: 'removed' }, filePathSnapshot: 'removed.typ' }] });
  const page = await f.uc.events('project', owner, '0');
  const m = (page.events[0].data as { message: MessageView }).message;
  assert.equal(m.body, null); assert.equal(m.author.displayName, 'Người dùng đã xóa');
  const deleted = page.events[1].data as { thread: ThreadView; comment: CommentView };
  assert.equal(deleted.comment.body, null); assert.equal(deleted.thread.comments[0].body, null);
  assert.equal(deleted.thread.commentsNextCursor, null);
  const missing = (page.events[2].data as { thread: ThreadView }).thread;
  assert.equal(missing.anchorStatus, 'file_deleted'); assert.equal(missing.filePath, 'removed.typ');
});

test('event entity hydration scopes every lookup to the requested project', async () => {
  const f = fixture({ events: [event(1, 'chat.message.created', 'foreign-message'),
    event(2, 'comment.reply.created', 'foreign-comment'), event(3, 'comment.thread.created', 'foreign-thread')],
  messages: [{ ...message('foreign-message'), projectId: 'other-project' }],
  comments: [{ ...comment('foreign-comment', 'foreign-thread'), projectId: 'other-project' }],
  threads: [{ ...thread('foreign-thread'), projectId: 'other-project' }] });
  assert.deepEqual((await f.uc.events('project', owner, '0')).events.map(e => e.data),
    [{ message: null }, { thread: null, comment: null }, { thread: null }]);
});

test('read-state is loaded once per requesting actor and never shared between replay calls', async () => {
  const events = [event(1, 'chat.read.changed', 'owner'), event(2, 'chat.read.changed', 'owner'),
    event(3, 'chat.read.changed', 'viewer', 'viewer')];
  const f = fixture({ events });
  const a = await f.uc.events('project', owner, '0');
  assert.deepEqual(a.events.map(e => e.data), [{ lastReadMessageSeq: '10', unreadCount: 90 },
    { lastReadMessageSeq: '10', unreadCount: 90 }, {}]);
  assert.equal(f.count('mark'), 1); assert.equal(f.count('unread'), 1);
  const b = await f.uc.events('project', { userId: 'viewer', role: 'student' }, '0');
  assert.deepEqual(b.events.map(e => e.data), [{}, {}, { lastReadMessageSeq: '20', unreadCount: 80 }]);
  assert.equal(f.count('mark'), 2); assert.equal(f.count('unread'), 2);
  const foreignOnly = fixture({ events: events.slice(0, 2) });
  await foreignOnly.uc.events('project', { userId: 'viewer', role: 'student' }, '0');
  assert.equal(foreignOnly.count('mark'), 0); assert.equal(foreignOnly.count('unread'), 0);
});

test('replay rejects inactive, password-reset, blocked and oversight-only actors before loading events', async () => {
  const cases: Array<{ actor: { userId: string; role: 'student' | 'admin' }; options: Parameters<typeof fixture>[0] }> = [
    { actor: owner, options: { users: { owner: { isActive: false, mustChangePassword: false, role: 'student' as const } } } },
    { actor: owner, options: { users: { owner: { isActive: true, mustChangePassword: true, role: 'student' as const } } } },
    { actor: { userId: 'viewer', role: 'student' as const }, options: { blocked: ['viewer'] } },
    { actor: { userId: 'admin', role: 'admin' as const }, options: { blocked: ['admin'],
      users: { admin: { isActive: true, mustChangePassword: false, role: 'admin' as const } } } },
  ];
  for (const { actor, options } of cases) {
    const f = fixture(options);
    await assert.rejects(f.uc.events('project', actor, '0'), { code: 'PROJECT_ACCESS_DENIED' });
    assert.equal(f.count('events'), 0); assert.equal(f.count('messages'), 0);
  }
});

test('legacy projects without collaboration state return an empty read-only snapshot', async () => {
  const f = fixture({ state: null });
  assert.deepEqual(await f.uc.events('project', owner, '0'), { events: [], nextCursor: '0', highWatermark: '0', hasMore: false });
  assert.equal(f.count('events'), 0); assert.equal(f.count('execute'), 1);
  await assert.rejects(f.uc.events('project', owner, '1'), { code: 'INVALID_CURSOR' });
});

test('an up-to-date cursor avoids event scanning and payload hydration', async () => {
  const f = fixture();
  assert.deepEqual(await f.uc.events('project', owner, '1000'), {
    events: [], nextCursor: '1000', highWatermark: '1000', hasMore: false,
  });
  for (const method of ['events', 'messages', 'replies', 'threads', 'roots', 'mark', 'unread']) assert.equal(f.count(method), 0, method);
  assert.equal(f.count('accessFacts'), 1);
});

test('replay preserves sequence order, high-watermark and exact full-page cursor contract', async () => {
  const f = fixture({ events: [event(9, 'project.updated', null), event(3, 'file.updated', null), event(6, 'file.deleted', null)],
    state: { lastEventSeq: 12n, accessVersion: 8n } });
  const full = await f.uc.events('project', owner, '0', 2);
  assert.deepEqual(full.events.map(e => e.seq), ['3', '6']);
  assert.equal(full.highWatermark, '12'); assert.equal(full.nextCursor, '6'); assert.equal(full.hasMore, true);
  assert.ok(full.events.every(e => e.accessVersion === '8'));
  const last = await f.uc.events('project', owner, '6', 2);
  assert.deepEqual(last.events.map(e => e.seq), ['9']);
  assert.equal(last.highWatermark, '12'); assert.equal(last.nextCursor, '12'); assert.equal(last.hasMore, false);
  await assert.rejects(f.uc.events('project', owner, '13'), { code: 'INVALID_CURSOR' });
});
