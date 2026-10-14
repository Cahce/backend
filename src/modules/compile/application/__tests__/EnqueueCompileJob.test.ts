import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EnqueueCompileJob } from '../EnqueueCompileJob.js';
import { CompileJob } from '../../domain/CompileJob.js';
import type { CompileJobRepository } from '../../domain/CompileJobRepository.js';
import type { OfficialCompileAccessPolicy } from '../../domain/Policies.js';
import type { CompileQueue } from '../../domain/CompileQueue.js';

const TIMEOUT_MS = 30_000;

function makeJob(
  id: string,
  status: 'queued' | 'running' = 'queued',
  createdAt: Date = new Date(),
): CompileJob {
  return new CompileJob(id, 'proj-1', 'main.typ', status, [], null, createdAt, createdAt);
}

function makeRepo(overrides: Partial<CompileJobRepository> = {}): CompileJobRepository {
  return {
    create: async (_data) => makeJob('new-job'),
    findById: async () => null,
    findActiveByEntry: async () => null,
    listByProjectId: async () => [],
    findAllQueued: async () => [],
    findRunningOlderThan: async () => [],
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
    admit: async (_key, work) => work(async id => { enqueuedIds.push(id); }),
    hasJob: () => false,
    enqueue: async (id) => { enqueuedIds.push(id); },
    start: () => {},
    stop: async () => {},
  };
}

describe('EnqueueCompileJob', () => {
  it('creates and enqueues a new job', async () => {
    const enqueuedIds: string[] = [];
    const useCase = new EnqueueCompileJob(makeRepo(), allowAll, makeQueue(enqueuedIds), TIMEOUT_MS);

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
    const useCase = new EnqueueCompileJob(repo, allowAll, makeQueue(enqueuedIds), TIMEOUT_MS);

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
    const useCase = new EnqueueCompileJob(makeRepo(), denyAll, makeQueue(), TIMEOUT_MS);

    await assert.rejects(
      () => useCase.execute({ projectId: 'proj-1', userId: 'user-1', userRole: 'student', entryPath: 'main.typ', format: 'pdf', engine: 'node' }),
      /PROJECT_ACCESS_DENIED/,
    );
  });

  it('fails an expired active job and creates a new one instead of reusing it', async () => {
    const timeoutMs = 1_000;
    // Older than 2 * timeoutMs + 60s grace.
    const expiredCreatedAt = new Date(Date.now() - (2 * timeoutMs + 60_000 + 5_000));
    const expired = makeJob('expired-job', 'running', expiredCreatedAt);
    const savedJobs: CompileJob[] = [];
    const enqueuedIds: string[] = [];
    const repo = makeRepo({
      findActiveByEntry: async () => expired,
      save: async (job) => { savedJobs.push(job); },
    });
    const useCase = new EnqueueCompileJob(repo, allowAll, makeQueue(enqueuedIds), timeoutMs);

    const job = await useCase.execute({
      projectId: 'proj-1',
      userId: 'user-1',
      userRole: 'student',
      entryPath: 'main.typ',
      format: 'pdf',
      engine: 'node',
    });

    assert.equal(job.id, 'new-job');
    assert.equal(expired.status, 'failed');
    assert.equal(expired.diagnostics.length, 1);
    assert.equal(expired.diagnostics[0].message, 'Job quá hạn, đã bị hủy');
    assert.ok(savedJobs.includes(expired), 'expired job must be persisted as failed');
    assert.deepEqual(enqueuedIds, ['new-job']);
  });

  it('still reuses an active job that is within the expiry window', async () => {
    const timeoutMs = 1_000;
    const recent = makeJob('recent-job', 'running', new Date(Date.now() - timeoutMs));
    const enqueuedIds: string[] = [];
    const repo = makeRepo({ findActiveByEntry: async () => recent });
    const useCase = new EnqueueCompileJob(repo, allowAll, makeQueue(enqueuedIds), timeoutMs);

    const job = await useCase.execute({
      projectId: 'proj-1',
      userId: 'user-1',
      userRole: 'student',
      entryPath: 'main.typ',
      format: 'pdf',
      engine: 'node',
    });

    assert.equal(job.id, 'recent-job');
    assert.equal(recent.status, 'running');
    assert.equal(enqueuedIds.length, 0);
  });
});
