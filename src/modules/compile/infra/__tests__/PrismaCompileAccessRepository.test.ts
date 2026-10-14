import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '../../../../generated/prisma/index.js';
import { PrismaCompileAccessRepository } from '../PrismaCompileAccessRepository.js';
import { CompileJobError } from '../../domain/Errors.js';

function makePrisma(project: { ownerId: string } | null): PrismaClient {
  return {
    $queryRaw: async () => project ? [{ ...project, isActive: true, mustChangePassword: false, role: 'student', version: '1',
      memberStatus: null, roleOverride: null, grants: [] }] : [],
    project: {
      findUnique: async () => project,
    },
    user: { findUnique: async () => ({ isActive: true, mustChangePassword: false, role: 'student' }) },
    projectMember: { findUnique: async () => null },
    projectCollaborationState: { findUnique: async () => null },
  } as unknown as PrismaClient;
}

function isCompileJobError(code: string) {
  return (error: unknown): boolean =>
    error instanceof CompileJobError && error.code === code;
}

describe('PrismaCompileAccessRepository.requireProjectAccess', () => {
  it('throws CompileJobError PROJECT_NOT_FOUND when the project does not exist', async () => {
    const repo = new PrismaCompileAccessRepository(makePrisma(null));

    await assert.rejects(
      () => repo.requireProjectAccess('proj-1', 'user-1'),
      isCompileJobError('PROJECT_NOT_FOUND'),
    );
  });

  it('throws CompileJobError PROJECT_ACCESS_DENIED when the user is not the owner', async () => {
    const repo = new PrismaCompileAccessRepository(makePrisma({ ownerId: 'owner-1' }));

    await assert.rejects(
      () => repo.requireProjectAccess('proj-1', 'someone-else'),
      isCompileJobError('PROJECT_ACCESS_DENIED'),
    );
  });

  it('resolves for the project owner', async () => {
    const repo = new PrismaCompileAccessRepository(makePrisma({ ownerId: 'owner-1' }));

    await repo.requireProjectAccess('proj-1', 'owner-1');
  });
});
