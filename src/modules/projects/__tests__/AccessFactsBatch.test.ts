import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma, type PrismaClient } from '../../../generated/prisma/index.js';
import { accessFor, accessForMany, type Actor } from '../infra/CollaborationTransaction.js';

type Facts = { userId: string; ownerId: string | null; isActive: boolean; mustChangePassword: boolean;
  role: Actor['role']; version: string; memberStatus: 'active' | 'blocked' | 'left' | null;
  roleOverride: 'viewer' | 'commenter' | 'editor' | null;
  grants: Array<{ revokedAt: string | null; shareLink: { role: 'viewer' | 'commenter' | 'editor'; revokedAt: string | null; expiresAt: string | null } }> };
const actor = (userId: string): Actor => ({ userId, role: 'student' });
const facts = (userId: string, patch: Partial<Facts> = {}): Facts => ({ userId, ownerId: 'owner', isActive: true,
  mustChangePassword: false, role: 'student', version: '19', memberStatus: null, roleOverride: null, grants: [], ...patch });
function fixture(rows: Facts[]) {
  const queries: Prisma.Sql[] = [];
  const db = { $queryRaw: async (query: Prisma.Sql) => {
    queries.push(query);
    if (query.sql.includes('wanted."userId"')) {
      assert.equal(query.values.at(-1), 'project');
      return rows.filter(row => query.values.slice(0, -1).includes(row.userId));
    }
    return rows.filter(row => row.userId === query.values[0]);
  } } as unknown as PrismaClient;
  return { db, queries };
}

test('batch access shares one scoped statement and matches singleton domain policies for every actor', async () => {
  const deadline = new Date(Date.now() + 60_000).toISOString();
  const rows = [facts('owner'), facts('viewer', { memberStatus: 'active', roleOverride: 'viewer' }),
    facts('commenter', { memberStatus: 'active', roleOverride: 'commenter' }),
    facts('editor', { memberStatus: 'active', grants: [{ revokedAt: null, shareLink: { role: 'editor', revokedAt: null, expiresAt: deadline } }] }),
    facts('expired', { memberStatus: 'active', grants: [{ revokedAt: null, shareLink: { role: 'editor', revokedAt: null, expiresAt: new Date(0).toISOString() } }] }),
    facts('blocked', { memberStatus: 'blocked', roleOverride: 'editor' }), facts('left', { memberStatus: 'left', roleOverride: 'editor' }),
    facts('inactive', { isActive: false, memberStatus: 'active', roleOverride: 'editor' }),
    facts('reset', { mustChangePassword: true, memberStatus: 'active', roleOverride: 'editor' }),
    facts('oversight', { role: 'admin' }), facts('forged-admin')];
  const f = fixture(rows), actors = rows.map(row => actor(row.userId)); actors.at(-1)!.role = 'admin';
  const result = await accessForMany(f.db, 'project', actors);
  assert.equal(f.queries.length, 1); assert.equal(result.size, actors.length);
  assert.deepEqual(actors.map(a => result.get(a.userId)?.canReadChat), [true, true, true, true, false, false, false, false, false, false, false]);
  assert.equal(result.get('editor')?.validUntil, deadline);
  assert.equal(result.get('commenter')?.canComment, true); assert.equal(result.get('viewer')?.canComment, false);
  assert.equal(result.get('oversight')?.canRead, true); assert.equal(result.get('oversight')?.canReadChat, false);
  for (const a of actors) assert.deepEqual(result.get(a.userId), await accessFor(f.db, 'project', a), a.userId);
  const query = f.queries[0];
  assert.match(query.sql, /u\.id = wanted\."userId"/);
  assert.match(query.sql, /m\."projectId" = p\.id AND m\."userId" = wanted\."userId"/);
  assert.match(query.sql, /g\."memberId" = m\.id AND g\."projectId" = p\.id/);
  assert.match(query.sql, /l\."projectId" = p\.id/);
  assert.match(query.sql, /AT TIME ZONE 'UTC'/);
  assert(!query.sql.includes('forged-admin'), 'user identities must be parameters');
});

test('batch access deduplicates actor tabs and checks cardinality before issuing SQL', async () => {
  const f = fixture([facts('owner')]);
  assert.equal((await accessForMany(f.db, 'project', [])).size, 0); assert.equal(f.queries.length, 0);
  const result = await accessForMany(f.db, 'project', [actor('owner'), actor('owner')]);
  assert.equal(result.size, 1); assert.deepEqual(f.queries[0].values, ['owner', 'project']);
  await assert.rejects(accessForMany(f.db, 'project', Array.from({ length: 51 }, () => actor('owner'))), { code: 'VALIDATION_ERROR' });
  assert.equal(f.queries.length, 1);
});

test('missing accounts and orphaned projects never inherit a different recipient access decision', async () => {
  const f = fixture([facts('owner'), facts('missing', { isActive: false }), facts('orphan', {
    ownerId: null, role: 'admin', memberStatus: 'active', roleOverride: 'editor' })]);
  const result = await accessForMany(f.db, 'project', ['owner', 'missing', 'orphan'].map(actor));
  assert.equal(result.get('owner')?.canReadChat, true); assert.equal(result.get('missing')?.canReadChat, false);
  assert.equal(result.get('orphan')?.canReadChat, false);
  await assert.rejects(accessForMany(fixture([]).db, 'project', [actor('owner')]), { code: 'PROJECT_NOT_FOUND' });
});
