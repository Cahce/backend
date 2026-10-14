import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveMembership, type MembershipFacts, type SharedRole } from '../domain/access/SharingPolicies.js';
import { resolveProjectAccess } from '../domain/Project/Policies.js';
const now = new Date('2026-10-03T00:00:00Z');
const grant = (role: SharedRole, expiresAt: Date | null = null) => ({ revokedAt: null,
  shareLink: { role, expiresAt, revokedAt: null } });
const member = (grants: MembershipFacts['grants']): MembershipFacts => ({ status: 'active', roleOverride: null, grants });
describe('effective shared membership', () => {
  it('uses the strongest current grant, then immediately falls back after its revocation', () => {
    const m = member([grant('viewer'), grant('editor')]); assert.equal(effectiveMembership(m, true, now).membershipRole, 'editor');
    m.grants[1].shareLink.revokedAt = now; assert.equal(effectiveMembership(m, true, now).membershipRole, 'viewer');
  });
  it('expiry is exclusive at exactly expiresAt; revoked grants never count', () => {
    const m = member([grant('editor', now), grant('commenter', new Date(now.getTime() + 1)), grant('viewer')]);
    assert.equal(effectiveMembership(m, true, now).membershipRole, 'commenter');
    m.grants[1].revokedAt = now; assert.equal(effectiveMembership(m, true, now).membershipRole, 'viewer');
  });
  it('owner override replaces link permissions including a lower override', () => {
    const m = { ...member([grant('editor')]), roleOverride: 'viewer' as const };
    assert.deepEqual(effectiveMembership(m, true, now), { membershipRole: 'viewer', validUntil: null });
  });
  it('blocked, left, missing member and orphan project all remove effective membership', () => {
    const m = member([grant('editor')]);
    for (const status of ['blocked', 'left'] as const) assert.equal(effectiveMembership({ ...m, status, roleOverride: 'editor' }, true, now).membershipRole, null);
    assert.equal(effectiveMembership(m, false, now).membershipRole, null); assert.equal(effectiveMembership(null, true, now).membershipRole, null);
  });
  it('returns the next expiry check time without changing a permanent lower grant', () => {
    const expiry = new Date(now.getTime() + 1000); const m = member([grant('viewer'), grant('editor', expiry)]);
    assert.equal(effectiveMembership(m, true, now).validUntil, expiry.toISOString());
    assert.equal(effectiveMembership(m, true, expiry).membershipRole, 'viewer');
  });
  it('inactive account has no rights even when it is the project owner or an admin', () => {
    assert.equal(resolveProjectAccess({ ownerId: 'u', userId: 'u', role: 'admin', isActive: false, membershipRole: 'editor' }), 'none');
    assert.equal(resolveProjectAccess({ ownerId: 'other', userId: 'u', role: 'admin', isActive: true, membershipRole: 'commenter' }), 'commenter');
  });
});
