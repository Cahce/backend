import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import Fastify from 'fastify';
import { metricsPlugin } from '../Metrics.js';
import { lifecyclePlugin } from '../Lifecycle.js';
import type { AppConfig } from '../../config/index.js';

async function fixture(enabled: boolean, token = randomBytes(32).toString('hex')) {
  const app = Fastify();
  app.decorate('config', { observability: { metricsEnabled: enabled, metricsToken: token } } as AppConfig);
  await app.register(metricsPlugin);
  app.get('/items/:id', async () => ({ ok: true }));
  return { app, headers: { authorization: `Bearer ${token}` } };
}

test('metrics disabled by default and enabled endpoint requires its own token before collection', async () => {
  const off = await fixture(false), on = await fixture(true);
  try {
    assert.equal((await off.app.inject('/metrics')).statusCode, 404);
    assert.equal(off.app.serviceMetrics, undefined);
    const metrics = on.app.serviceMetrics!;
    let collects = 0;
    metrics.bindPool(() => { collects++; return { total: 2, idle: 1, waiting: 3 }; });
    assert.equal((await on.app.inject('/metrics')).statusCode, 401);
    assert.equal((await on.app.inject({ url: '/metrics', headers: { authorization: 'Bearer invalid' } })).statusCode, 401);
    assert.equal(collects, 0);
    const replies = await Promise.all(Array.from({ length: 20 }, () => on.app.inject({ url: '/metrics', headers: on.headers })));
    for (const reply of replies) {
      assert.equal(reply.statusCode, 200); assert.equal(reply.headers['cache-control'], 'no-store');
      assert.match(String(reply.headers['content-type']), /text\/plain.*version=0.0.4/);
      assert.match(reply.body, /tlu_db_pool_connections\{state="waiting"\} 3/);
    }
    assert.equal(collects, 1, 'concurrent authorized scrapes share one collection');
  } finally { await off.app.close(); await on.app.close(); }
});

test('metrics use bounded templates and enums without retaining URLs, identities, SQL, or authorization', async () => {
  const { app, headers } = await fixture(true);
  try {
    await app.register(async child => { child.get('/records/:id', async () => ({})); }, { prefix: '/api/v1' });
    for (let i = 0; i < 100; i++) {
      await app.inject(`/items/private-id-${i}?token=private-query`);
      await app.inject(`/missing-private-path-${i}`);
    }
    await app.inject('/api/v1/records/private-record');
    app.serviceMetrics!.observeQuery('SELECT private_secret FROM private_document', 12);
    app.serviceMetrics!.observeQuery('UNTRUSTED_VARIABLE_OPERATION with private_text', 2);
    const response = await app.inject({ url: '/metrics', headers });
    assert.match(response.body, /route="\/items\/:id",status_class="2xx"\} 100/);
    assert.match(response.body, /route="__unmatched__",status_class="4xx"\} 100/);
    assert.match(response.body, /route="\/api\/v1\/records\/:id"/);
    assert.match(response.body, /tlu_db_query_duration_seconds_count\{operation="SELECT"\} 1/);
    assert.match(response.body, /tlu_db_query_duration_seconds_count\{operation="OTHER"\} 1/);
    assert(!response.body.includes('private') && !response.body.includes('UNTRUSTED_VARIABLE') && !response.body.includes(headers.authorization));
  } finally { await app.close(); }
});

test('registries are app-local, keep serving while draining and clear resources on close', async () => {
  const a = await fixture(true), b = await fixture(true);
  const metrics = a.app.serviceMetrics!;
  try {
    await a.app.register(lifecyclePlugin, { probe: { async check() {} } });
    await a.app.ready(); a.app.lifecycle.beginDrain();
    assert.equal((await a.app.inject({ url: '/metrics', headers: a.headers })).statusCode, 200);
    await a.app.close();
    assert.deepEqual(await metrics.registry.getMetricsAsJSON(), []);
    assert.equal((await b.app.inject({ url: '/metrics', headers: b.headers })).statusCode, 200);
  } finally { await a.app.close(); await b.app.close(); }
});
