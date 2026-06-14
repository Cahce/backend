import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveProjectAccess,
  capabilitiesFor,
  ProjectAuthPolicy,
  type AuthContext,
} from '../domain/Project/Policies.js';
import type { Project } from '../domain/Project/Types.js';
import { TemplateCategory } from '../domain/Project/Types.js';

const OWNER = 'user-owner';
const OTHER = 'user-other';

function project(ownerId: string | null): Project {
  return {
    id: 'p1',
    title: 'T',
    category: TemplateCategory.Report,
    ownerId,
    templateId: null,
    templateVersionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastEditedAt: null,
  };
}

describe('resolveProjectAccess', () => {
  it('owner: ownerId === userId', () => {
    assert.equal(
      resolveProjectAccess({ ownerId: OWNER, userId: OWNER, role: 'student' }),
      'owner',
    );
  });

  it('admin on a non-owned project → adminOversight (read-only)', () => {
    assert.equal(
      resolveProjectAccess({ ownerId: OWNER, userId: OTHER, role: 'admin' }),
      'adminOversight',
    );
  });

  it('admin who owns the project (e.g. template source) → owner', () => {
    assert.equal(
      resolveProjectAccess({ ownerId: OWNER, userId: OWNER, role: 'admin' }),
      'owner',
    );
  });

  it('editor member → editor', () => {
    assert.equal(
      resolveProjectAccess({ ownerId: OWNER, userId: OTHER, role: 'student', membershipRole: 'editor' }),
      'editor',
    );
  });

  it('viewer member → viewer', () => {
    assert.equal(
      resolveProjectAccess({ ownerId: OWNER, userId: OTHER, role: 'teacher', membershipRole: 'viewer' }),
      'viewer',
    );
  });

  it('assigned advisor → advisor', () => {
    assert.equal(
      resolveProjectAccess({ ownerId: OWNER, userId: OTHER, role: 'teacher', isAdvisor: true }),
      'advisor',
    );
  });

  it('unrelated user → none', () => {
    assert.equal(
      resolveProjectAccess({ ownerId: OWNER, userId: OTHER, role: 'student' }),
      'none',
    );
  });

  it('precedence: owner beats membership', () => {
    assert.equal(
      resolveProjectAccess({ ownerId: OWNER, userId: OWNER, role: 'student', membershipRole: 'viewer' }),
      'owner',
    );
  });

  it('precedence: editor beats advisor', () => {
    assert.equal(
      resolveProjectAccess({ ownerId: OWNER, userId: OTHER, role: 'teacher', membershipRole: 'editor', isAdvisor: true }),
      'editor',
    );
  });
});

describe('capabilitiesFor', () => {
  it('owner has every capability', () => {
    const c = capabilitiesFor('owner');
    assert.deepEqual(c, {
      level: 'owner',
      canRead: true,
      canEdit: true,
      canDelete: true,
      canManageSettings: true,
      canCompileOfficial: true,
    });
  });

  it('adminOversight is read-only (no write/delete/compile)', () => {
    const c = capabilitiesFor('adminOversight');
    assert.equal(c.canRead, true);
    assert.equal(c.canEdit, false);
    assert.equal(c.canDelete, false);
    assert.equal(c.canManageSettings, false);
    assert.equal(c.canCompileOfficial, false);
  });

  it('editor can write + compile but not delete', () => {
    const c = capabilitiesFor('editor');
    assert.equal(c.canEdit, true);
    assert.equal(c.canCompileOfficial, true);
    assert.equal(c.canDelete, false);
  });

  it('viewer and advisor are read-only', () => {
    for (const level of ['viewer', 'advisor'] as const) {
      const c = capabilitiesFor(level);
      assert.equal(c.canRead, true, `${level} canRead`);
      assert.equal(c.canEdit, false, `${level} canEdit`);
      assert.equal(c.canCompileOfficial, false, `${level} canCompileOfficial`);
    }
  });

  it('none has no capabilities', () => {
    const c = capabilitiesFor('none');
    assert.equal(c.canRead, false);
    assert.equal(c.canEdit, false);
  });
});

describe('ProjectAuthPolicy facade (no blanket admin write)', () => {
  const adminOnOther: AuthContext = { userId: OTHER, role: 'admin' };
  const ownerCtx: AuthContext = { userId: OWNER, role: 'student' };

  it('admin can read but NOT write/delete a non-owned project', () => {
    const p = project(OWNER);
    assert.equal(ProjectAuthPolicy.canRead(p, adminOnOther), true);
    assert.equal(ProjectAuthPolicy.canWrite(p, adminOnOther), false);
    assert.equal(ProjectAuthPolicy.canDelete(p, adminOnOther), false);
    assert.equal(ProjectAuthPolicy.canCompileOfficial(p, adminOnOther), false);
  });

  it('owner retains full control', () => {
    const p = project(OWNER);
    assert.equal(ProjectAuthPolicy.canRead(p, ownerCtx), true);
    assert.equal(ProjectAuthPolicy.canWrite(p, ownerCtx), true);
    assert.equal(ProjectAuthPolicy.canDelete(p, ownerCtx), true);
  });
});
