import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createGracefulShutdown } from '../GracefulShutdown.js';

test('concurrent signals run one drain followed by one close', async () => {
  const order: string[] = [];
  const stop = createGracefulShutdown({ beginDrain: () => { order.push('drain'); },
    close: async () => { order.push('close'); }, reportError: assert.fail,
    forceExit: () => assert.fail('unexpected forced exit'), drainMs: 5, timeoutMs: 200 });
  const first = stop(), second = stop();
  assert.equal(first, second); assert.deepEqual(order, ['drain']);
  await first; assert.deepEqual(order, ['drain', 'close']);
});

test('a stuck close has a hard deadline', async () => {
  let release!: () => void, forced = 0;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const stop = createGracefulShutdown({ beginDrain() {}, close: () => blocked,
    reportError: assert.fail, forceExit: () => { forced++; }, drainMs: 0, timeoutMs: 15 });
  const pending = stop();
  await delay(30); assert.equal(forced, 1);
  release(); await pending;
});
