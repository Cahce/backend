import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EnqueueCompileJob } from '../EnqueueCompileJob.js';
import { CompileJob } from '../../domain/CompileJob.js';
import type { CompileJobRepository } from '../../domain/CompileJobRepository.js';
import type { OfficialCompileAccessPolicy } from '../../domain/Policies.js';
import type { CompileQueue } from '../../domain/CompileQueue.js';

function makeJob(id: string, status: 'queued' | 'running' = 'queued'): CompileJob {
  return new CompileJob(id, 'proj-1', 'main.typ', status, [], null, new Date(), new Date());
}

function makeRepo(overrides: Partial<CompileJobRepository> = {}): CompileJobRepository {
  return {
    create: async (_data) => makeJob('new-job'),
    findById: async () => null,
    findActiveByEntry: async () => null,
    listByProjectId: async () => [],
    save: async () => {},
    ...overrides,
  };
}

const allowAll: OfficialCompileAccessPolicy = {
  requireOfficialCompileAccess: async () => {},
};

const denyAll: OfficialCompileAccessPolicy = {
  requireOfficialCompileAccess: async () => {
    throw new Error('PROJECT_ACCESS_DENIED');
  },
};

function makeQueue(enqueuedIds: string[] = []): CompileQueue {
  return {
    enqueue: async (id) => { enqueuedIds.push(id); },
    start: () => {},
    stop: async () => {},
  };
}

describe('EnqueueCompileJob', () => {
  it('creates and enqueues a new job', async () => {
    const enqueuedIds: string[] = [];
    const useCase = new EnqueueCompileJob(makeRepo(), allowAll, makeQueue(enqueuedIds));

    const job = await useCase.execute({
      projectId: 'proj-1',
      userId: 'user-1',
      userRole: 'student',
      entryPath: 'main.typ',
      format: 'pdf',
      engine: 'node',
    });

    assert.equal(job.id, 'new-job');
    assert.equal(enqueuedIds.length, 1);
    assert.equal(enqueuedIds[0], 'new-job');
  });

  it('returns existing active job without enqueuing again (deduplication)', async () => {
    const existing = makeJob('existing-job', 'queued');
    const enqueuedIds: string[] = [];
    const repo = makeRepo({ findActiveByEntry: async () => existing });
    const useCase = new EnqueueCompileJob(repo, allowAll, makeQueue(enqueuedIds));

    const job = await useCase.execute({
      projectId: 'proj-1',
      userId: 'user-1',
      userRole: 'student',
      entryPath: 'main.typ',
      format: 'pdf',
      engine: 'node',
    });

    assert.equal(job.id, 'existing-job');
    assert.equal(enqueuedIds.length, 0);
  });

  it('throws when access is denied', async () => {
    const useCase = new EnqueueCompileJob(makeRepo(), denyAll, makeQueue());

    await assert.rejects(
      () => useCase.execute({ projectId: 'proj-1', userId: 'user-1', userRole: 'student', entryPath: 'main.typ', format: 'pdf', engine: 'node' }),
      /PROJECT_ACCESS_DENIED/,
    );
  });
});
