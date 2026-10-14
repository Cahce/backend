import assert from 'node:assert/strict';
import test from 'node:test';
import { enqueueOrReuseCompileJob } from '../EnqueueOrReuseCompileJob.js';
import { BoundedCompileQueue } from '../../infra/BoundedCompileQueue.js';
import { CompileJob } from '../../domain/CompileJob.js';
import type { CompileJobRepository } from '../../domain/CompileJobRepository.js';
import type { CompileQueue } from '../../domain/CompileQueue.js';

const data = { projectId: 'project', entryPath: 'main.typ', format: 'pdf', engine: 'node' } as const;
function fixture() {
  const jobs: CompileJob[] = [];
  const repo: CompileJobRepository = {
    create: async input => {
      const job = new CompileJob(String(jobs.length), input.projectId, input.entryPath, 'queued', [], null, new Date(), new Date());
      jobs.push(job); return job;
    },
    findById: async id => jobs.find(job => job.id === id) ?? null,
    findActiveByEntry: async (projectId, path) => jobs.find(job => job.projectId === projectId && job.entryPath === path && ['queued', 'running'].includes(job.status)) ?? null,
    listByProjectId: async () => jobs,
    findAllQueued: async () => [], findRunningOlderThan: async () => [], save: async () => {},
  };
  return { jobs, repo };
}

test('concurrent member/admin admission creates one job and full queue still reuses it', async () => {
  const { repo, jobs } = fixture();
  let finish!: () => void;
  const processing = new Promise<void>(resolve => { finish = resolve; });
  const queue = new BoundedCompileQueue({ execute: () => processing }, repo, { enabled: true, timeoutMs: 1000, maxOutstandingJobs: 1 });
  try {
    const results = await Promise.all(Array.from({ length: 100 }, (_, i) =>
      enqueueOrReuseCompileJob(repo, queue, { ...data, ...(i % 2 ? { actorId: 'member' } : {}) }, 1000)));
    assert.equal(jobs.length, 1);
    assert(results.every(result => result.id === jobs[0].id));
    assert.equal((await enqueueOrReuseCompileJob(repo, queue, data, 1000)).id, jobs[0].id);
    await assert.rejects(enqueueOrReuseCompileJob(repo, queue, { ...data, entryPath: 'other.typ' }, 1000), { code: 'COMPILE_QUEUE_FULL' });
    assert.equal(jobs.length, 1, 'overload must not leave a durable queued row');
  } finally { const stopping = queue.stop(); finish(); await stopping; }
});

test('an old queued job is not expired, and old running work owned by this queue is not killed', async () => {
  const { repo, jobs } = fixture();
  const old = new Date(0);
  jobs.push(new CompileJob('old', data.projectId, data.entryPath, 'queued', [], null, old, old));
  const queue: CompileQueue = { admit: async () => { throw new Error('must reuse'); }, hasJob: () => true,
    enqueue: async () => {}, start: () => {}, stop: async () => {} };
  assert.equal((await enqueueOrReuseCompileJob(repo, queue, data, 1000)).id, 'old');
  jobs[0].start();
  const running = new CompileJob('old', data.projectId, data.entryPath, 'running', [], null, old, old);
  jobs[0] = running;
  assert.equal(await enqueueOrReuseCompileJob(repo, queue, data, 1000), running);
  assert.equal(running.status, 'running');
});

test('failure after DB creation records a failed job; disabled admission never creates one', async () => {
  const { repo, jobs } = fixture();
  const queue: CompileQueue = { admit: async (_key, work) => work(async () => { throw new Error('stopping'); }),
    hasJob: () => false, enqueue: async () => {}, start: () => {}, stop: async () => {} };
  await assert.rejects(enqueueOrReuseCompileJob(repo, queue, data, 1000), /stopping/);
  assert.equal(jobs[0].status, 'failed');
  const disabled = new BoundedCompileQueue({ execute: async () => {} }, repo, { enabled: false, timeoutMs: 1000 });
  await assert.rejects(enqueueOrReuseCompileJob(repo, disabled, data, 1000), { code: 'COMPILE_UNAVAILABLE' });
  assert.equal(jobs.length, 1);
});
