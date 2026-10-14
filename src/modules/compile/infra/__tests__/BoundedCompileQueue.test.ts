import assert from 'node:assert/strict';
import test from 'node:test';
import { BoundedCompileQueue } from '../BoundedCompileQueue.js';
import { CompileJob } from '../../domain/CompileJob.js';
import type { CompileJobRepository } from '../../domain/CompileJobRepository.js';

function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
const repository: CompileJobRepository = {
  create: async () => { throw new Error('unused'); }, findById: async () => null, findActiveByEntry: async () => null,
  listByProjectId: async () => [], findAllQueued: async () => [], findRunningOlderThan: async () => [], save: async () => {},
};

test('capacity includes pending DB creation, queued and running work; rejection creates no job', async () => {
  const processing = deferred(), creating = deferred(); let created = 0;
  const queue = new BoundedCompileQueue({ execute: () => processing.promise }, repository,
    { enabled: true, timeoutMs: 1000, maxOutstandingJobs: 2 });
  await queue.enqueue('running');
  const pending = queue.admit('project:new.typ', async enqueue => {
    await creating.promise; created++; await enqueue('created'); return 'created';
  });
  assert.throws(() => queue.admit('overflow', async () => { created++; }), { code: 'COMPILE_QUEUE_FULL' });
  assert.equal(created, 0);
  creating.resolve(); await pending;
  assert.throws(() => queue.admit('overflow', async () => { created++; }), { code: 'COMPILE_QUEUE_FULL' });
  assert.equal(created, 1);
  const stopping = queue.stop(); processing.resolve(); await stopping;
});

test('same-entry admissions coalesce and failed DB work releases reservation and key', async () => {
  const creating = deferred(); let created = 0;
  const queue = new BoundedCompileQueue({ execute: async () => {} }, repository,
    { enabled: true, timeoutMs: 1000, maxOutstandingJobs: 1 });
  const a = queue.admit('p:main.typ', async () => { created++; await creating.promise; throw new Error('DB create failed'); });
  const b = queue.admit('p:main.typ', async () => { created++; return 'should not run'; });
  assert.equal(a, b); creating.resolve();
  await assert.rejects(a, /DB create failed/); await assert.rejects(b, /DB create failed/);
  assert.equal(created, 1);
  assert.equal(await queue.admit('p:main.typ', async () => 'retry'), 'retry');
  await queue.stop();
});

test('disabled and stopping queues reject admission before creation', async () => {
  let created = false;
  for (const enabled of [false, true]) {
    const queue = new BoundedCompileQueue({ execute: async () => {} }, repository, { enabled, timeoutMs: 1000 });
    if (enabled) await queue.stop();
    assert.throws(() => queue.admit('p:main.typ', async () => { created = true; }), { code: 'COMPILE_UNAVAILABLE' });
  }
  assert.equal(created, false);
});

test('restart drains a durable backlog in bounded batches with one active compiler', async () => {
  const durable = Array.from({ length: 7 }, (_, i) => new CompileJob(String(i), 'p', `${i}.typ`, 'queued', [], null, new Date(), new Date()));
  const batches: number[] = []; let active = 0, maximum = 0, processed = 0;
  const done = deferred();
  const repo = { ...repository, findAllQueued: async (limit = 100, excludeIds: string[] = []) => {
    batches.push(limit); return durable.filter(job => job.status === 'queued' && !excludeIds.includes(job.id)).slice(0, limit);
  } };
  const queue = new BoundedCompileQueue({ execute: async id => {
    active++; maximum = Math.max(maximum, active);
    const job = durable.find(item => item.id === id)!; job.start();
    await new Promise(resolve => setTimeout(resolve, 5));
    job.fail([]); active--; if (++processed === durable.length) done.resolve();
  } }, repo, { enabled: true, timeoutMs: 1000, maxOutstandingJobs: 2 });
  queue.start(); await done.promise; await queue.stop();
  assert.equal(processed, 7); assert.equal(maximum, 1); assert(batches.every(size => size <= 2));
});

test('shutdown rejects an in-flight admission enqueue and wakes queued waiters', async () => {
  const creating = deferred();
  let processed = false;
  const queue = new BoundedCompileQueue({ execute: async () => { processed = true; } }, repository,
    { enabled: true, timeoutMs: 1000, maxOutstandingJobs: 1 });
  const waiting = queue.waitForSettle('not-started');
  const pending = queue.admit('p:main.typ', async enqueue => {
    await creating.promise;
    await enqueue('not-started');
  });
  const rejected = assert.rejects(pending, { code: 'COMPILE_UNAVAILABLE' });
  const stopping = queue.stop();
  creating.resolve();
  await rejected; await stopping; await waiting;
  assert.equal(processed, false);
});

test('waiter cancellation releases the callback before the durable job settles', async () => {
  const queue = new BoundedCompileQueue({ execute: async () => {} }, repository,
    { enabled: true, timeoutMs: 1000 });
  const controller = new AbortController();
  const waiting = queue.waitForSettle('unknown', controller.signal);
  controller.abort(); await waiting;
  // Check no retained callback without making the runtime expose test-only counters.
  const state = queue as unknown as { settleWaiters: Map<string, unknown> };
  assert.equal(state.settleWaiters.size, 0);
  await queue.stop();
});
