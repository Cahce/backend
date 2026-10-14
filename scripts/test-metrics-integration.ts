// Read-only PostgreSQL checks: no schema/migration/application data changes.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import Fastify from 'fastify';
import type { AppConfig } from '../src/config/index.js';
import { metricsPlugin } from '../src/plugins/Metrics.js';
import { prismaPlugin } from '../src/plugins/Prisma.js';

test('actual Prisma pool exposes bounded query/acquisition metrics, including acquisition timeout', { timeout: 15000 }, async () => {
  assert(process.env.DATABASE_URL, 'DATABASE_URL must identify the local test PostgreSQL');
  const app = Fastify();
  app.decorate('config', { observability: { metricsEnabled: true, metricsToken: randomBytes(32).toString('hex') },
    db: { url: process.env.DATABASE_URL, poolMax: 1, connectionTimeoutMs: 500 } } as AppConfig);
  try {
    await app.register(metricsPlugin); await app.register(prismaPlugin); await app.ready();
    await app.prisma.$queryRaw`SELECT 1 AS value`; // Warm the TCP connection before testing queue timeout.
    const held = app.prisma.$queryRaw`SELECT 1 AS value FROM pg_sleep(1.2)`
      .then(() => undefined, error => error as Error);
    await delay(50);
    await assert.rejects(app.prisma.$queryRaw`SELECT 1 AS value`);
    assert.equal(await held, undefined, 'the query holding the connection must finish successfully');
    const rows = await app.prisma.$queryRaw<{ value: number }[]>`SELECT 1 AS value`;
    assert.equal(rows[0].value, 1, 'pool recovers after saturation');
    const text = await app.serviceMetrics!.registry.metrics();
    assert.match(text, /tlu_db_pool_acquire_seconds_count\{result="error"\} 1/);
    assert.match(text, /tlu_db_query_duration_seconds_count\{operation="SELECT"\} [2-9]/);
    assert.match(text, /tlu_db_pool_connections\{state="waiting"\} 0/);
    assert(!text.includes('pg_sleep') && !text.includes(process.env.DATABASE_URL));
  } finally { await app.close(); }
});

test('disabled metrics keep actual Prisma query and disconnect behavior', async () => {
  assert(process.env.DATABASE_URL);
  const app = Fastify();
  app.decorate('config', { observability: { metricsEnabled: false },
    db: { url: process.env.DATABASE_URL, poolMax: 1, connectionTimeoutMs: 1000 } } as AppConfig);
  try {
    await app.register(metricsPlugin); await app.register(prismaPlugin); await app.ready();
    assert.equal(app.serviceMetrics, undefined);
    assert.equal((await app.prisma.$queryRaw<{ value: number }[]>`SELECT 1 AS value`)[0].value, 1);
  } finally { await app.close(); }
});
