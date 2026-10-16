import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '../../../generated/prisma/index.js';
import { BatchedRealtimeSessionPolicy } from '../infra/BatchedRealtimeSessionPolicy.js';
import type { RealtimeSession } from '../domain/RealtimePorts.js';

const session = (i: number, projectId = `p${Math.floor(i / 5)}`): RealtimeSession => ({ projectId,
  actor: { userId: `u${i}`, role: 'student' }, jti: `t${i}`, expiresAt: Date.now() + 60_000 });
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; }
function fixture(options: { connectionTimeoutMs?: number } = {}) {
  let calls = 0, completed = 0;
  const queries: { sql: string; requested: Array<{ projectId: string; userId: string; jti: string }> }[] = [];
  const controls: string[] = [], transactions: Array<{ maxWait: number; timeout: number }> = [];
  const users = Array.from({ length: 100 }, (_, i) => ({ id: `u${i}`, isActive: true, mustChangePassword: false, role: 'student' as 'student' | 'admin' }));
  const projects = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, ownerId: `u${i * 5}` as string | null }));
  const members = users.map((u, i) => ({ userId: u.id, projectId: `p${Math.floor(i / 5)}`, status: 'active' as 'active' | 'blocked' | 'left',
    roleOverride: null as 'viewer' | 'commenter' | 'editor' | null,
    grants: [{ revokedAt: null as Date | null, shareLink: { role: 'editor' as const, revokedAt: null as Date | null, expiresAt: null as Date | null } }] }));
  const revoked: { jti: string }[] = [];
  const hooks = { beforeCommit: async () => {}, beforeRollback: async () => {} };
  const tx = {
    $executeRaw: async (strings: TemplateStringsArray) => { controls.push(strings.join('')); return 0; },
    $queryRaw: async (strings: TemplateStringsArray, parameter: string) => {
      calls++;
      const requested = JSON.parse(parameter) as Array<{ projectId: string; userId: string; jti: string }>;
      queries.push({ sql: strings.join('?'), requested });
      return requested.map((r, idx) => {
        const project = projects.find(p => p.id === r.projectId), user = users.find(u => u.id === r.userId);
        const member = members.find(m => m.projectId === r.projectId && m.userId === r.userId);
        return { idx, projectId: project?.id ?? null, ownerId: project?.ownerId ?? null,
          userId: user?.id ?? null, role: user?.role ?? null, isActive: user?.isActive ?? null, mustChangePassword: user?.mustChangePassword ?? null,
          memberStatus: member?.status ?? null, roleOverride: member?.roleOverride ?? null,
          grants: (member?.grants ?? []).filter(g => !g.revokedAt && !g.shareLink.revokedAt).map(g => ({ revokedAt: null,
            shareLink: { role: g.shareLink.role, revokedAt: null, expiresAt: g.shareLink.expiresAt?.toISOString() ?? null } })),
          revoked: revoked.some(t => t.jti === r.jti) };
      });
    },
  };
  const db = { $transaction: async (work: (client: typeof tx) => Promise<unknown>, settings: { maxWait: number; timeout: number }) => {
    transactions.push(settings);
    try { const result = await work(tx); await hooks.beforeCommit(); return result; }
    catch (error) { await hooks.beforeRollback(); throw error; }
    finally { completed++; }
  } };
  return { users, projects, members, revoked, db, tx, hooks, queries, controls, transactions,
    calls: () => calls, completed: () => completed,
    policy: new BatchedRealtimeSessionPolicy(db as unknown as PrismaClient, options) };
}

test('100 users across 20 projects share one READ ONLY timed data SELECT, with no TTL cache', async () => {
  const f = fixture();
  assert((await Promise.all(Array.from({ length: 100 }, (_, i) => f.policy.validate(session(i))))).every(Boolean));
  assert.equal(f.calls(), 1); assert.equal(f.completed(), 1);
  assert.deepEqual(f.controls, ['SET TRANSACTION READ ONLY', "SET LOCAL statement_timeout = '2000ms'"]);
  assert.deepEqual(f.transactions, [{ maxWait: 6000, timeout: 4000 }]);
  f.revoked.push({ jti: 't9' });
  assert.equal(await f.policy.validate(session(9)), false);
  assert.equal(f.calls(), 2, 'next check must read current database state');
});

test('current roles, blocked/left, expiry, orphan, inactive and password-change requirements are preserved', async () => {
  const f = fixture();
  f.members[1].status = 'blocked'; f.members[2].status = 'left';
  f.members[3].grants[0].shareLink.expiresAt = new Date(0);
  f.users[4].isActive = false; f.users[5].mustChangePassword = true;
  f.projects[2].ownerId = null; f.users[17].role = 'admin'; f.members[17].grants = [];
  const outcomes = await Promise.all([0, 1, 2, 3, 4, 5, 10, 11, 17].map(i => f.policy.validate(session(i))));
  assert.deepEqual(outcomes, [true, false, false, false, false, false, false, false, false]);
  assert.equal(await f.policy.validate(session(1, 'p1')), false, 'membership in p0 must not leak into p1');
});

test('queued token expiry is checked after transaction completion and query errors fail closed', async () => {
  const f = fixture(), gate = deferred();
  f.hooks.beforeCommit = () => gate.promise;
  const s = session(0), result = f.policy.validate(s);
  await tick(); s.expiresAt = 0; gate.resolve();
  assert.equal(await result, false);
  f.tx.$queryRaw = async () => { throw new Error('database unavailable'); };
  await assert.rejects(f.policy.validate(session(0)), /database unavailable/);
});

test('batch size is bounded and invalid JWT deadlines never touch the database', async () => {
  const f = fixture();
  for (const expiresAt of [NaN, Infinity, 0]) assert.equal(await f.policy.validate({ ...session(0), expiresAt }), false);
  assert.equal(await f.policy.validate({ ...session(0), jti: '' }), false);
  assert.equal(f.calls(), 0);
  const outcomes = await Promise.all(Array.from({ length: 450 }, (_, i) => f.policy.validate(session(i % 100))));
  assert(outcomes.every(Boolean)); assert.equal(f.calls(), 3);
  assert.deepEqual(f.queries.map(query => query.requested.length), [200, 200, 50]);
});

test('query represents exact project-user pairs and distinct JTIs even for repeated actor sessions', async () => {
  const f = fixture(), differentJti = { ...session(1), jti: 'revoked-other-session' };
  f.revoked.push({ jti: differentJti.jti });
  const outcomes = await Promise.all([session(1), session(6), session(1), session(1, 'p1'), differentJti].map(s => f.policy.validate(s)));
  assert.deepEqual(outcomes, [true, true, true, false, false]);
  assert.deepEqual(f.queries[0].requested, [
    { projectId: 'p0', userId: 'u1', jti: 't1' }, { projectId: 'p1', userId: 'u6', jti: 't6' },
    { projectId: 'p0', userId: 'u1', jti: 't1' }, { projectId: 'p1', userId: 'u1', jti: 't1' },
    { projectId: 'p0', userId: 'u1', jti: 'revoked-other-session' },
  ]);
  const sql = f.queries[0].sql;
  assert.match(sql, /SELECT DISTINCT "projectId", "userId" FROM requested/);
  assert.match(sql, /m\."projectId" = p\.id AND m\."userId" = u\.id/);
  assert.match(sql, /g\."memberId" = m\.id AND g\."projectId" = p\.id/);
  assert.match(sql, /l\."projectId" = p\.id/);
  assert.match(sql, /revoked\.jti = requested\.jti/);
  assert(!sql.includes('revoked-other-session'), 'identities must be a parameter, never interpolated SQL');
  assert(!/revoked\."expiresAt"/.test(sql), 'revocation remains existence-based');
});

test('revoked grants and links are denied on the next check and direct overrides keep domain precedence', async () => {
  const f = fixture();
  assert.equal(await f.policy.validate(session(1)), true);
  f.members[1].grants[0].revokedAt = new Date();
  assert.equal(await f.policy.validate(session(1)), false);
  f.members[1].grants[0].revokedAt = null;
  f.members[1].grants[0].shareLink.revokedAt = new Date();
  assert.equal(await f.policy.validate(session(1)), false);
  for (const role of ['viewer', 'commenter', 'editor'] as const) {
    f.members[1].roleOverride = role;
    assert.equal(await f.policy.validate(session(1)), true, `active direct ${role} override grants chat access`);
  }
  f.members[1].status = 'blocked';
  assert.equal(await f.policy.validate(session(1)), false, 'direct override cannot override blocked membership');
  f.members[1].status = 'left';
  assert.equal(await f.policy.validate(session(1)), false, 'direct override cannot override left membership');
});

test('uses persisted account roles and denies missing accounts/projects regardless of JWT role', async () => {
  const f = fixture();
  f.members[1].grants = [];
  const forgedAdmin = session(1); forgedAdmin.actor.role = 'admin';
  assert.equal(await f.policy.validate(forgedAdmin), false);
  f.users[2].role = 'admin';
  assert.equal(await f.policy.validate(session(2)), true, 'an admin with an active project grant may read chat');
  f.members[2].grants = [];
  assert.equal(await f.policy.validate(session(2)), false, 'admin oversight alone never grants chat access');
  assert.equal(await f.policy.validate(session(999, 'p0')), false);
  assert.equal(await f.policy.validate(session(0, 'missing-project')), false);
});

test('pending queue overflow fails closed and capacity is released after each transaction', async () => {
  const f = fixture();
  const accepted = Array.from({ length: 1000 }, (_, i) => f.policy.validate(session(i % 100)));
  assert.equal(await f.policy.validate(session(0)), false);
  assert.equal(f.calls(), 0, 'overflow is rejected before the scheduled database batch starts');
  assert((await Promise.all(accepted)).every(Boolean));
  assert.equal(f.calls(), 5, 'accepted checks are drained in five bounded batches');
  assert.equal(await f.policy.validate(session(0)), true);
  assert.equal(f.calls(), 6);
});

test('requests arriving during a read form a fresh batch instead of joining the in-flight snapshot', async () => {
  const f = fixture(), gate = deferred(), read = f.tx.$queryRaw;
  f.tx.$queryRaw = async (...args) => {
    const rows = await read(...args);
    if (f.calls() === 1) await gate.promise;
    return rows;
  };
  const first = f.policy.validate(session(1)); await tick(); assert.equal(f.calls(), 1);
  f.revoked.push({ jti: 't1' });
  const second = f.policy.validate(session(1)); await tick(); assert.equal(f.calls(), 1);
  gate.resolve();
  assert.equal(await first, true); assert.equal(await second, false); assert.equal(f.calls(), 2);
});

test('a failed read retains its batch slot until rollback settles before starting queued validation', async () => {
  const f = fixture(), rollback = deferred(), read = f.tx.$queryRaw;
  let rollingBack = false, failing = true;
  f.tx.$queryRaw = async (...args) => {
    const result = await read(...args);
    if (failing) throw new Error('statement timeout');
    return result;
  };
  f.hooks.beforeRollback = async () => { rollingBack = true; await rollback.promise; };
  let firstSettled = false;
  const first = f.policy.validate(session(1));
  const rejection = assert.rejects(first, /statement timeout/).then(() => { firstSettled = true; });
  await tick(); assert(rollingBack);
  const next = f.policy.validate(session(2)); await tick();
  assert.equal(f.calls(), 1); assert.equal(f.completed(), 0); assert.equal(firstSettled, false);
  failing = false; rollback.resolve();
  await rejection; assert.equal(await next, true); assert.equal(f.calls(), 2); assert.equal(f.completed(), 2);
});

test('UTC grant instants retain future and expired semantics', async () => {
  const f = fixture(), deadline = new Date(Date.now() + 30 * 60_000);
  f.members[1].grants[0].shareLink.expiresAt = deadline;
  assert.equal(await f.policy.validate(session(1)), true);
  assert.match(f.queries[0].sql, /'expiresAt', l\."expiresAt" AT TIME ZONE 'UTC'/);
  assert.match(f.queries[0].sql, /'revokedAt', g\."revokedAt" AT TIME ZONE 'UTC'/);
  f.members[1].grants[0].shareLink.expiresAt = new Date(Date.now() - 1);
  assert.equal(await f.policy.validate(session(1)), false);
});

test('ordinal projection is exact and incomplete or duplicate snapshots fail closed', async () => {
  const f = fixture(), read = f.tx.$queryRaw;
  f.members[1].status = 'blocked';
  f.tx.$queryRaw = async (...args) => (await read(...args)).reverse();
  assert.deepEqual(await Promise.all([f.policy.validate(session(0)), f.policy.validate(session(1))]), [true, false]);
  f.tx.$queryRaw = async (...args) => (await read(...args)).slice(1);
  await assert.rejects(f.policy.validate(session(0)), /Incomplete realtime validation snapshot/);
  f.tx.$queryRaw = async (...args) => {
    const rows = await read(...args); return [rows[0], rows[0]];
  };
  const outcomes = await Promise.allSettled([f.policy.validate(session(0)), f.policy.validate(session(1))]);
  assert(outcomes.every(outcome => outcome.status === 'rejected'));
});

test('configured pool acquisition budget leaves server and transaction execution deadlines unchanged', async () => {
  const f = fixture({ connectionTimeoutMs: 12_000 });
  assert.equal(await f.policy.validate(session(0)), true);
  assert.deepEqual(f.transactions, [{ maxWait: 13_000, timeout: 4000 }]);
  assert.deepEqual(f.controls, ['SET TRANSACTION READ ONLY', "SET LOCAL statement_timeout = '2000ms'"]);
  for (const connectionTimeoutMs of [NaN, 0, -1, 1.5, 60_001])
    assert.throws(() => fixture({ connectionTimeoutMs }), /Invalid realtime validation connection timeout/);
});
