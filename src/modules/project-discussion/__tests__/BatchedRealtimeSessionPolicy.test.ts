import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '../../../generated/prisma/index.js';
import { BatchedRealtimeSessionPolicy } from '../infra/BatchedRealtimeSessionPolicy.js';
import type { RealtimeSession } from '../domain/RealtimePorts.js';

const session = (i: number, projectId = `p${Math.floor(i / 5)}`): RealtimeSession => ({ projectId,
  actor: { userId: `u${i}`, role: 'student' }, jti: `t${i}`, expiresAt: Date.now() + 60_000 });
function fixture() {
  let calls = 0;
  const queries: { table: string; args: unknown }[] = [];
  const users = Array.from({ length: 100 }, (_, i) => ({ id: `u${i}`, isActive: true, mustChangePassword: false, role: 'student' as 'student' | 'admin' }));
  const projects = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, ownerId: `u${i * 5}` as string | null }));
  const members = users.map((u, i) => ({ userId: u.id, projectId: `p${Math.floor(i / 5)}`, status: 'active', roleOverride: null,
    grants: [{ revokedAt: null as Date | null, shareLink: { role: 'editor', revokedAt: null as Date | null, expiresAt: null as Date | null } }] }));
  const revoked: { jti: string }[] = [];
  const record = <T>(table: string, rows: T[]) => async (args?: unknown) => { calls++; queries.push({ table, args }); return rows; };
  const db = { project: { findMany: record('project', projects) }, user: { findMany: record('user', users) },
    projectMember: { findMany: record('projectMember', members) }, invalidToken: { findMany: record('invalidToken', revoked) } };
  return { users, projects, members, revoked, db, queries, calls: () => calls, policy: new BatchedRealtimeSessionPolicy(db as unknown as PrismaClient) };
}
test('100 users across 20 projects share four adapter queries, with no TTL cache after the batch', async () => {
  const f = fixture();
  assert((await Promise.all(Array.from({ length: 100 }, (_, i) => f.policy.validate(session(i))))).every(Boolean));
  assert.equal(f.calls(), 4);
  f.revoked.push({ jti: 't9' });
  assert.equal(await f.policy.validate(session(9)), false);
  assert.equal(f.calls(), 8, 'next check must read current database state');
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
test('queued token expiry is checked after database completion and errors fail closed', async () => {
  const f = fixture();
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  const original = f.db.user.findMany;
  f.db.user.findMany = async () => { await gate; return original(); };
  const s = session(0), result = f.policy.validate(s);
  await new Promise(resolve => setImmediate(resolve)); s.expiresAt = 0; release();
  assert.equal(await result, false);
  f.db.user.findMany = async () => { throw new Error('database unavailable'); };
  await assert.rejects(f.policy.validate(session(0)), /database unavailable/);
});
test('batch size is bounded and an invalid JWT deadline never touches the database', async () => {
  const f = fixture();
  assert.equal(await f.policy.validate({ ...session(0), expiresAt: NaN }), false);
  assert.equal(f.calls(), 0);
  const outcomes = await Promise.all(Array.from({ length: 450 }, (_, i) => f.policy.validate(session(i % 100))));
  assert(outcomes.every(Boolean)); assert.equal(f.calls(), 12);
});
test('membership queries use exact project-user pairs and deduplicate repeated sessions', async () => {
  const f = fixture();
  const outcomes = await Promise.all([session(1), session(6), session(1), session(1, 'p1')].map(s => f.policy.validate(s)));
  assert.deepEqual(outcomes, [true, true, true, false]);
  const membershipQuery = f.queries.find(q => q.table === 'projectMember')?.args as { where: unknown };
  assert.deepEqual(membershipQuery.where, { OR: [
    { projectId: 'p0', userId: 'u1' },
    { projectId: 'p1', userId: 'u6' },
    { projectId: 'p1', userId: 'u1' },
  ] });
  const tokenQuery = f.queries.find(q => q.table === 'invalidToken')?.args as { where: unknown };
  assert.deepEqual(tokenQuery.where, { jti: { in: ['t1', 't6'] } });
});
test('revoked grants and links are denied on the next check and direct overrides keep domain precedence', async () => {
  const f = fixture();
  assert.equal(await f.policy.validate(session(1)), true);
  f.members[1].grants[0].revokedAt = new Date();
  assert.equal(await f.policy.validate(session(1)), false);
  f.members[1].grants[0].revokedAt = null;
  f.members[1].grants[0].shareLink.revokedAt = new Date();
  assert.equal(await f.policy.validate(session(1)), false);
  const member = f.members[1] as Omit<typeof f.members[number], 'roleOverride'> & { roleOverride: 'viewer' | 'commenter' | 'editor' | null };
  for (const role of ['viewer', 'commenter', 'editor'] as const) {
    member.roleOverride = role;
    assert.equal(await f.policy.validate(session(1)), true, `active direct ${role} override grants chat access`);
  }
  member.status = 'blocked';
  assert.equal(await f.policy.validate(session(1)), false, 'direct override cannot override blocked membership');
  member.status = 'left';
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
test('pending queue overflow fails closed without adding database work for the rejected check', async () => {
  const f = fixture();
  const accepted = Array.from({ length: 1000 }, (_, i) => f.policy.validate(session(i % 100)));
  assert.equal(await f.policy.validate(session(0)), false);
  assert.equal(f.calls(), 0, 'overflow is rejected before the scheduled database batch starts');
  assert((await Promise.all(accepted)).every(Boolean));
  assert.equal(f.calls(), 20, 'accepted checks are drained in five bounded batches');
  assert.equal(await f.policy.validate(session(0)), true, 'capacity is released after each batch');
  assert.equal(f.calls(), 24);
});
