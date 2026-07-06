
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InProcessCompileQueue } from '../InProcessCompileQueue.js';

test('waitForSettle resolves after the job finishes processing', async () => {
  const processed: string[] = [];
  const handler = {
    execute: async (jobId: string) => {
      await new Promise((r) => setTimeout(r, 5));
      processed.push(jobId);
    },
  };
  const queue = new InProcessCompileQueue(handler, { enabled: true });
  queue.start();

  const settled = queue.waitForSettle('job-1');
  await queue.enqueue('job-1');

  await settled;
  assert.deepEqual(processed, ['job-1']);
});

test('waitForSettle resolves even when the handler throws (settles to failed)', async () => {
  const handler = {
    execute: async () => {
      await new Promise((r) => setTimeout(r, 1));
      throw new Error('compile boom');
    },
  };
  const queue = new InProcessCompileQueue(handler, { enabled: true });
  queue.start();

  const settled = queue.waitForSettle('job-err');
  await queue.enqueue('job-err');

  await settled;
  assert.ok(true);
});

test('waitForSettle targets the correct job', async () => {
  const handler = { execute: async () => { await new Promise((r) => setTimeout(r, 1)); } };
  const queue = new InProcessCompileQueue(handler, { enabled: true });
  queue.start();

  let bResolved = false;
  const b = queue.waitForSettle('B').then(() => { bResolved = true; });
  await queue.enqueue('B');
  await b;
  assert.equal(bResolved, true);
});
