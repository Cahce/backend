
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InProcessCompileQueue } from '../InProcessCompileQueue.js';
import { CompileJob } from '../../domain/CompileJob.js';
import type { CompileJobRepository } from '../../domain/CompileJobRepository.js';

const TIMEOUT_MS = 1_000;

function makeJob(
  id: string,
  status: 'queued' | 'running' = 'queued',
  at: Date = new Date(),
): CompileJob {
  return new CompileJob(id, 'proj-1', 'main.typ', status, [], null, at, at);
}

function makeRepo(overrides: Partial<CompileJobRepository> = {}): CompileJobRepository {
  return {
    create: async () => makeJob('unused'),
    findById: async () => null,
    findActiveByEntry: async () => null,
    listByProjectId: async () => [],
    findAllQueued: async () => [],
    findRunningOlderThan: async () => [],
    save: async () => {},
    ...overrides,
  };
}

test('waitForSettle resolves after the job finishes processing', async () => {
  const processed: string[] = [];
  const handler = {
    execute: async (jobId: string) => {
      await new Promise((r) => setTimeout(r, 5));
      processed.push(jobId);
    },
  };
  const queue = new InProcessCompileQueue(handler, makeRepo(), { enabled: true, timeoutMs: TIMEOUT_MS });
  queue.start();

  const settled = queue.waitForSettle('job-1');
  await queue.enqueue('job-1');

  await settled;
  assert.deepEqual(processed, ['job-1']);
  await queue.stop();
});

test('waitForSettle resolves even when the handler throws (settles to failed)', async () => {
  const handler = {
    execute: async () => {
      await new Promise((r) => setTimeout(r, 1));
      throw new Error('compile boom');
    },
  };
  const queue = new InProcessCompileQueue(handler, makeRepo(), { enabled: true, timeoutMs: TIMEOUT_MS });
  queue.start();

  const settled = queue.waitForSettle('job-err');
  await queue.enqueue('job-err');

  await settled;
  assert.ok(true);
  await queue.stop();
});

test('waitForSettle targets the correct job', async () => {
  const handler = { execute: async () => { await new Promise((r) => setTimeout(r, 1)); } };
  const queue = new InProcessCompileQueue(handler, makeRepo(), { enabled: true, timeoutMs: TIMEOUT_MS });
  queue.start();

  let bResolved = false;
  const b = queue.waitForSettle('B').then(() => { bResolved = true; });
  await queue.enqueue('B');
  await b;
  assert.equal(bResolved, true);
  await queue.stop();
});

test('start() recovers zombie jobs: re-enqueues queued and fails stale running', async () => {
  const staleAt = new Date(Date.now() - 10 * TIMEOUT_MS);
  const queuedJob = makeJob('job-queued', 'queued');
  const staleRunning = makeJob('job-stale', 'running', staleAt);
  const savedJobs: CompileJob[] = [];
  const thresholds: Date[] = [];
  const repo = makeRepo({
    findAllQueued: async () => queuedJob.status === 'queued' ? [queuedJob] : [],
    findRunningOlderThan: async (olderThan) => {
      thresholds.push(olderThan);
      return [staleRunning];
    },
    save: async (job) => { savedJobs.push(job); },
  });
  const processed: string[] = [];
  const handler = { execute: async (jobId: string) => { processed.push(jobId); queuedJob.fail([]); } };
  const queue = new InProcessCompileQueue(handler, repo, { enabled: true, timeoutMs: TIMEOUT_MS });

  const settled = queue.waitForSettle('job-queued');
  queue.start();
  await settled;

  // Queued job was re-enqueued and processed.
  assert.deepEqual(processed, ['job-queued']);

  // Stale running job was failed and persisted (recovery fails stale jobs before re-enqueueing).
  assert.equal(staleRunning.status, 'failed');
  assert.equal(staleRunning.diagnostics.length, 1);
  assert.equal(staleRunning.diagnostics[0].message, 'Job bị gián đoạn do máy chủ khởi động lại');
  assert.ok(savedJobs.includes(staleRunning), 'stale job must be persisted as failed');

  // Threshold is ~2x timeout in the past.
  assert.equal(thresholds.length, 1);
  const ageMs = Date.now() - thresholds[0].getTime();
  assert.ok(ageMs >= 2 * TIMEOUT_MS - 100 && ageMs <= 2 * TIMEOUT_MS + 1_000);
  await queue.stop();
});

test('start() does not scan the DB when the worker is disabled', async () => {
  let scanned = false;
  const repo = makeRepo({
    findAllQueued: async () => { scanned = true; return []; },
    findRunningOlderThan: async () => { scanned = true; return []; },
  });
  const handler = { execute: async () => {} };
  const queue = new InProcessCompileQueue(handler, repo, { enabled: false, timeoutMs: TIMEOUT_MS });

  queue.start();
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(scanned, false);
  await queue.stop();
});
