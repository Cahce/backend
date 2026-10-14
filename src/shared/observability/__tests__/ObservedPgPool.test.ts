import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Pool } from 'pg';
import { observePgPool } from '../ObservedPgPool.js';
import { ServiceMetrics } from '../ServiceMetrics.js';

test('pool observer preserves Promise/callback client ownership, errors and restore behavior', async () => {
  let fail = false, released = 0;
  const failure = new Error('private-connection-error');
  const release = () => { released++; };
  const client = { release };
  const pool = { totalCount: 2, idleCount: 1, waitingCount: 0,
    connect(callback?: (error: Error | undefined, value: unknown, done: () => void) => void) {
      if (callback) { queueMicrotask(() => callback(fail ? failure : undefined, fail ? undefined : client, release)); return; }
      return fail ? Promise.reject(failure) : Promise.resolve(client);
    },
  } as unknown as Pool;
  const metrics = new ServiceMetrics(), original = pool.connect;
  const restore = observePgPool(pool, metrics);
  try {
    const received = await pool.connect(); assert.equal(received, client); received.release();
    await new Promise<void>((resolve, reject) => pool.connect((error, value, done) => {
      if (error) return reject(error); assert.equal(value, client); assert.equal(done, release); done(); resolve();
    }));
    fail = true;
    await assert.rejects(pool.connect(), error => error === failure);
    await new Promise<void>(resolve => pool.connect((error, value) => {
      assert.equal(error, failure); assert.equal(value, undefined); resolve();
    }));
    assert.equal(released, 2, 'observer must not take ownership of release');
    const text = await metrics.registry.metrics();
    assert.match(text, /tlu_db_pool_acquire_seconds_count\{result="success"\} 2/);
    assert.match(text, /tlu_db_pool_acquire_seconds_count\{result="error"\} 2/);
    assert(!text.includes(failure.message));
    restore(); assert.equal(pool.connect, original);
  } finally { restore(); metrics.close(); }
});
