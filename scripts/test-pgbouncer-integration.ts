// Explicit isolated lab only. Never loads dotenv or falls back to the application's DATABASE_URL.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { Client, Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { PostgresProjectEventWakeSource } from '../src/modules/project-discussion/infra/PostgresProjectEventWakeSource.js';

function endpoint(url: URL) { return `${url.hostname.toLowerCase()}:${url.port || '5432'}`; }
function readLabUrls() {
  const keys = ['TEST_PGBOUNCER_URL', 'TEST_PGBOUNCER_DIRECT_URL', 'TEST_PGBOUNCER_ADMIN_URL'] as const;
  const parsed = keys.map(key => {
    assert(process.env[key], `${key} is required; run the isolated PgBouncer lab first`);
    let value: URL;
    try { value = new URL(process.env[key]!); } catch { throw new Error(`${key} must be a PostgreSQL URL`); }
    assert(['postgres:', 'postgresql:'].includes(value.protocol) && value.hostname && value.username, 'Invalid lab connection URL');
    assert(!value.searchParams.has('options'), 'Lab URLs must not override connection options/search_path');
    return value;
  });
  const [pooled, direct, admin] = parsed;
  assert.equal(pooled.pathname, '/pooler_test', 'Only the isolated pooler_test database is allowed');
  assert.equal(direct.pathname, '/pooler_test', 'Only the isolated pooler_test database is allowed');
  assert.equal(admin.pathname, '/pgbouncer', 'A dedicated PgBouncer console URL is required');
  assert.equal(endpoint(pooled), endpoint(admin), 'Console must be on the tested pooler endpoint');
  assert.notEqual(endpoint(pooled), endpoint(direct), 'LISTEN/DDL require a separate direct endpoint');
  return { pooled: pooled.toString(), direct: direct.toString(), admin: admin.toString() };
}
async function until(predicate: () => boolean | Promise<boolean>, message: string, timeoutMs = 3000) {
  const deadline = performance.now() + timeoutMs;
  while (!(await predicate())) {
    if (performance.now() >= deadline) assert.fail(message);
    await delay(20);
  }
}

test('PgBouncer lab: actual Prisma transactions, prepared statements, LISTEN, saturation and reconnect', { timeout: 45000 }, async context => {
  const urls = readLabUrls();
  const schema = `codex_pooler_${randomBytes(8).toString('hex')}`;
  assert.match(schema, /^codex_pooler_[a-f0-9]{16}$/);
  const clients: Client[] = [];
  const connect = async (connectionString: string) => {
    const client = new Client({ connectionString, connectionTimeoutMillis: 3000, query_timeout: 5000 });
    client.on('error', () => {}); // Errors are asserted by the pending query; avoid an uncaught event on expected timeout.
    clients.push(client); await client.connect(); return client;
  };
  let created = false;
  let prisma: PrismaClient | undefined, pool: Pool | undefined, wake: PostgresProjectEventWakeSource | undefined;
  try {
    const consoleClient = await connect(urls.admin);
    const version = String((await consoleClient.query('SHOW VERSION')).rows[0]?.version ?? '');
    const versionParts = /^PgBouncer (\d+)\.(\d+)\.(\d+)/.exec(version);
    assert(versionParts && (Number(versionParts[1]) > 1 || (Number(versionParts[1]) === 1 && Number(versionParts[2]) >= 26)),
      'PgBouncer 1.26.0 or later is required for this lab');
    const configRows = (await consoleClient.query<{ key: string; value: string }>('SHOW CONFIG')).rows;
    const settings = Object.fromEntries(configRows.map(row => [row.key, row.value]));
    assert.equal(settings.pool_mode, 'transaction');
    assert(Number(settings.max_prepared_statements) > 0);
    assert.equal(Number(settings.max_db_connections), 2, 'Use the lab server cap of 2');
    assert(Number(settings.query_wait_timeout) > 0 && Number(settings.query_wait_timeout) <= 2, 'Lab requires bounded short queue wait');
    const aliases = (await consoleClient.query('SHOW DATABASES')).rows;
    const alias = aliases.find(row => row.name === 'pooler_test');
    assert(alias && alias.database === 'pooler_test', 'Pooler alias must target the isolated test database');
    assert(!alias.pool_mode || alias.pool_mode === 'transaction', 'Alias must not override transaction mode');
    assert.equal(Number(alias.max_connections), 2, 'Alias must retain the lab hard cap');
    context.diagnostic(`${version}; transaction mode; server cap=2; prepared statements enabled`);

    const direct = await connect(urls.direct);
    assert.equal((await direct.query('SELECT current_database() AS db')).rows[0].db, 'pooler_test');
    await direct.query(`CREATE SCHEMA "${schema}"`); created = true;
    // Session state only on this direct connection, never on a transaction pool connection.
    await direct.query(`SET search_path TO "${schema}"`);
    const fixture = await readFile(new URL('./fixtures/project-sharing-baseline.sql', import.meta.url), 'utf8');
    await direct.query(fixture.replace('CREATE SCHEMA IF NOT EXISTS "public";', ''));
    pool = new Pool({ connectionString: urls.pooled, max: 4, connectionTimeoutMillis: 3000, query_timeout: 5000 });
    pool.on('error', () => {});
    prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema }) });
    const db = prisma;
    await db.$connect();

    await context.test('generated Prisma CRUD and interactive commit/rollback stay in the fixture schema', async () => {
      await db.user.create({ data: { id: 'committed', email: 'pooler@e.tlu.edu.vn', role: 'student', passwordHash: 'not-a-login-hash' } });
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: 'committed' } })).role, 'student');
      await db.$transaction(async tx => { await tx.user.update({ where: { id: 'committed' }, data: { role: 'teacher' } }); });
      await assert.rejects(db.$transaction(async tx => {
        await tx.user.create({ data: { id: 'rolled-back', email: 'rollback@e.tlu.edu.vn', role: 'student', passwordHash: 'not-a-login-hash' } });
        throw new Error('intentional rollback');
      }), /intentional rollback/);
      assert.equal(await db.user.count(), 1);
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: 'committed' } })).role, 'teacher');
      const counts = await Promise.all(Array.from({ length: 12 }, () => db.user.count()));
      assert(counts.every(value => value === 1));
      assert.equal(Number((await direct.query(`SELECT count(*) AS count FROM "${schema}"."User"`)).rows[0].count), 1);
    });

    await context.test('SET LOCAL timeout and search_path do not leak into later transactions', async () => {
      const before = (await db.$queryRaw<{ timeout: string }[]>`SELECT current_setting('statement_timeout') AS timeout`)[0].timeout;
      await db.$transaction(async tx => {
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
        assert.equal((await tx.$queryRaw<{ count: bigint }[]>`SELECT count(*) AS count FROM "User"`)[0].count, 1n);
      });
      await assert.rejects(db.$transaction(async tx => {
        await tx.$executeRaw`SET LOCAL statement_timeout = '150ms'`;
        await tx.$queryRaw`SELECT 1 AS value FROM pg_sleep(0.4)`;
      }, { maxWait: 2000, timeout: 3000 }), /statement timeout/);
      assert.equal((await db.$queryRaw<{ timeout: string }[]>`SELECT current_setting('statement_timeout') AS timeout`)[0].timeout, before);
      assert.equal((await db.$queryRaw<{ schema: string }[]>`SELECT current_schema() AS schema`)[0].schema, 'public');
    });

    const channel = `project_events_${createHash('md5').update(schema).digest('hex')}`;
    const received: string[] = [];
    wake = new PostgresProjectEventWakeSource({ connectionString: urls.direct, options: `-c search_path=${schema}` });
    wake.subscribe(projectId => received.push(projectId));
    await wake.start();
    await context.test('actual direct wake adapter only receives NOTIFY after commit, never rollback', async () => {
      await assert.rejects(db.$transaction(async tx => {
        await tx.$queryRaw`SELECT pg_notify(${channel}, 'rolled-back-event')::text AS sent`;
        throw new Error('notification rollback');
      }), /notification rollback/);
      await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT pg_notify(${channel}, 'committed-event')::text AS sent`;
        await delay(50); assert.deepEqual(received, []);
      });
      await until(() => received.includes('committed-event'), 'Direct listener did not receive committed notification');
      assert.deepEqual(received, ['committed-event']);
    });

    const a = await connect(urls.pooled), b = await connect(urls.pooled);
    const prepared = (value: number) => ({ name: 'pooler_test_statement',
      text: 'SELECT $1::integer AS value, pg_backend_pid() AS pid', values: [value] });
    await context.test('protocol prepared statement survives a backend hop and equal names on different clients', async () => {
      const first = (await a.query(prepared(7))).rows[0];
      try {
        await b.query('BEGIN');
        const heldPid = (await b.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        assert.equal(heldPid, first.pid, 'Lab expects default LIFO reuse to hold the previously used server');
        const second = (await a.query(prepared(8))).rows[0];
        assert.equal(second.value, 8); assert.notEqual(second.pid, first.pid, 'Prepared query must exercise a different server');
      } finally { await b.query('ROLLBACK'); }
      const collision = await b.query({ name: 'pooler_test_statement', text: 'SELECT $1::integer + 1 AS value', values: [10] });
      assert.equal(collision.rows[0].value, 11);
    });

    await context.test('server cap bounds concurrent transactions and query wait timeout recovers', async () => {
      const queued = await connect(urls.pooled);
      try {
        await a.query('BEGIN'); await b.query('BEGIN');
        const first = (await a.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        const second = (await b.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        assert.notEqual(first, second);
        await assert.rejects(queued.query('SELECT 1 AS value'), /query_wait_timeout/);
      } finally {
        await Promise.all([a.query('ROLLBACK'), b.query('ROLLBACK')]);
        await queued.end().catch(() => {});
      }
      assert.equal((await a.query('SELECT 1 AS value')).rows[0].value, 1);
      assert.equal(await db.user.count(), 1);
    });

    await context.test('pooler RECONNECT restores Prisma and named prepared work without interrupting direct LISTEN', async () => {
      const before = (await a.query(prepared(12))).rows[0].pid;
      // Only this explicitly named lab alias; never issue unscoped RECONNECT/KILL.
      await consoleClient.query('RECONNECT pooler_test');
      await consoleClient.query('WAIT_CLOSE pooler_test');
      const after = (await a.query(prepared(13))).rows[0];
      assert.notEqual(after.pid, before); assert.equal(after.value, 13);
      assert.equal(await db.user.count(), 1);
      await db.$queryRaw`SELECT pg_notify(${channel}, 'after-reconnect')::text AS sent`;
      await until(() => received.includes('after-reconnect'), 'Direct listener did not survive pooler reconnect');
      assert(!received.includes('rolled-back-event'));
    });
  } finally {
    await wake?.stop();
    await prisma?.$disconnect().catch(() => {});
    await pool?.end().catch(() => {});
    await Promise.allSettled(clients.map(client => client.end()));
    if (created) {
      // A fresh direct cleanup connection; only the run-owned schema can be dropped.
      assert.match(schema, /^codex_pooler_[a-f0-9]{16}$/);
      const cleanup = new Client({ connectionString: urls.direct, connectionTimeoutMillis: 3000, query_timeout: 5000 });
      cleanup.on('error', () => {});
      try { await cleanup.connect(); await cleanup.query(`DROP SCHEMA "${schema}" CASCADE`); }
      finally { await cleanup.end().catch(() => {}); }
      context.diagnostic('Scratch schema removed');
    }
  }
});
