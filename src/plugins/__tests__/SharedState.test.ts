import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer, type Socket } from 'node:net';
import Fastify from 'fastify';
import type { AppConfig } from '../../config/index.js';
import { sharedStatePlugin } from '../SharedState.js';
import { lifecyclePlugin } from '../Lifecycle.js';
import { healthRoutes } from '../../api/health.js';
import { ServiceMetrics } from '../../shared/observability/ServiceMetrics.js';
import { randomBytes } from 'node:crypto';

test('local mode does not create a Redis dependency or Redis metrics', async () => {
  const app = Fastify();
  app.decorate('config', { sharedState: { driver: 'local' } } as AppConfig);
  await app.register(sharedStatePlugin);
  try { await app.ready(); assert.equal(app.sharedRedis, undefined); }
  finally { await app.close(); }
});

test('Redis handshake outage allows bounded startup, reports not ready, exports counters and closes resources', async () => {
  const sockets = new Set<Socket>();
  const server = createServer(socket => { sockets.add(socket); socket.on('data', () => {}); socket.on('close', () => sockets.delete(socket)); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  const app = Fastify(), metrics = new ServiceMetrics();
  app.decorate('config', { sharedState: { driver: 'redis', url: `redis://127.0.0.1:${address.port}`,
    namespace: 'test', keySecret: randomBytes(32).toString('hex'),
    commandTimeoutMs: 50, connectTimeoutMs: 100, maxPending: 1 } } as AppConfig);
  app.decorate('serviceMetrics', metrics);
  try {
    await app.register(sharedStatePlugin);
    await app.register(lifecyclePlugin, { probe: { async check() {} } });
    await app.register(healthRoutes);
    await app.ready();
    assert.equal((await app.inject('/health/ready')).statusCode, 503);
    assert.equal((await app.inject('/health/live')).statusCode, 200);
    const body = await metrics.registry.metrics();
    assert.match(body, /tlu_redis_state\{state="ready"\} 0/);
    assert.match(body, /tlu_redis_timeouts_total 1/);
    assert.equal(body.includes(`127.0.0.1:${address.port}`), false);
  } finally {
    await app.close(); metrics.close();
    assert.equal(app.sharedRedis?.isReady, false);
    for (const socket of sockets) socket.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
