import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import Fastify from 'fastify';
import { lifecyclePlugin } from '../Lifecycle.js';
import { healthRoutes } from '../../api/health.js';
import type { BoundedRedisConnection } from '../../shared/redis/BoundedRedisConnection.js';

test('health contracts and drain rejection do not query a dependency on every request', async () => {
  const app = Fastify(); let probes = 0, writes = 0;
  await app.register(lifecyclePlugin, { probe: { async check() { probes++; } } });
  await app.register(healthRoutes);
  app.post('/work', async () => { writes++; return { ok: true }; });
  try {
    await app.ready(); await delay(1);
    for (let i = 0; i < 20; i++) assert.equal((await app.inject('/health/ready')).statusCode, 200);
    assert.equal(probes, 1);
    app.lifecycle.beginDrain();
    assert.equal((await app.inject('/health/ready')).statusCode, 503);
    assert.equal((await app.inject('/health/live')).statusCode, 200);
    const legacy = await app.inject('/health');
    assert.equal(legacy.json().status, 'ok'); assert.equal(typeof legacy.json().timestamp, 'string');
    const rejected = await app.inject({ method: 'POST', url: '/work' });
    assert.equal(rejected.statusCode, 503); assert.equal(rejected.headers['retry-after'], '1');
    assert.equal(writes, 0);
  } finally { await app.close(); }
});

test('dependency outage affects readiness, not liveness', async () => {
  const app = Fastify();
  await app.register(lifecyclePlugin, { probe: { async check() { throw new Error('offline'); } } });
  await app.register(healthRoutes);
  try {
    assert.equal((await app.inject('/health/ready')).statusCode, 503);
    assert.equal((await app.inject('/health/live')).statusCode, 200);
  } finally { await app.close(); }
});

test('shared Redis outage immediately removes readiness without affecting liveness', async () => {
  const app = Fastify(); let ready = true, probes = 0;
  app.decorate('sharedRedis', { get isReady() { return ready; }, async command() { probes++; return 'PONG'; } } as unknown as BoundedRedisConnection);
  await app.register(lifecyclePlugin, { probe: { async check() {} } });
  await app.register(healthRoutes);
  try {
    await app.ready(); await delay(1);
    assert.equal((await app.inject('/health/ready')).statusCode, 200);
    ready = false;
    assert.equal((await app.inject('/health/ready')).statusCode, 503);
    assert.equal((await app.inject('/health/live')).statusCode, 200);
    assert.equal(probes, 1);
  } finally { await app.close(); }
});

test('Redis early rejection cannot start overlapping slow primary probes', async () => {
  const app = Fastify(); let probes = 0;
  let release: (() => void) | undefined;
  const slow = new Promise<void>(resolve => { release = resolve; });
  app.decorate('sharedRedis', { isReady: false, async command() { throw new Error('unavailable'); } } as unknown as BoundedRedisConnection);
  await app.register(lifecyclePlugin, { probe: { async check() { probes++; await slow; } } });
  await app.register(healthRoutes);
  try {
    await app.ready(); await delay(1150);
    assert.equal((await app.inject('/health/ready')).statusCode, 503);
    assert.equal(probes, 1);
  } finally { release?.(); await app.close(); }
});
