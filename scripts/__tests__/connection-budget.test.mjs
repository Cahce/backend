import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { evaluateConnectionBudget, verifyPoolerConfig } from '../lib/connection-budget.mjs';

const example = JSON.parse(await readFile(new URL('../../../deploy/pgbouncer/connection-budget.json', import.meta.url), 'utf8'));
const ini = await readFile(new URL('../../../deploy/pgbouncer/pgbouncer.ini', import.meta.url), 'utf8');
const copy = () => structuredClone(example);

test('checked-in config includes rollout/draining processes, LISTEN, ops and reserved slots', () => {
  const result = evaluateConnectionBudget(copy());
  assert.equal(result.passed, true);
  assert.equal(result.required, 78); assert.equal(result.available, 97); assert.equal(result.spare, 19);
  assert.equal(result.poolConnections, 30); assert.equal(result.directConnections, 3);
  assert.equal(result.serverConnections, 60);
  verifyPoolerConfig(ini, result.plan.poolers[0]);
});
test('rolling poolers and each database alias multiply PostgreSQL server demand', () => {
  const plan = copy();
  plan.poolers[0].terminating = 1;
  assert.equal(evaluateConnectionBudget(plan).passed, false);
  plan.poolers[0].terminating = 0;
  plan.poolers[0].databases.push({ alias: 'another-alias-same-primary', maxConnections: 30 });
  assert.equal(evaluateConnectionBudget(plan).serverConnections, 120);
  assert.equal(evaluateConnectionBudget(plan).passed, false);
});
test('a single surviving pooler must accept every peak client; averaging hides overload', () => {
  const plan = copy();
  plan.poolers[0].maxClientConnections = 49;
  const result = evaluateConnectionBudget(plan);
  assert.equal(result.required, 78);
  assert.equal(result.passed, false);
  assert.match(result.violations[0], /failover/);
});
test('direct mode counts every worker/process pool plus dedicated connections', () => {
  const plan = copy(); plan.mode = 'direct'; plan.poolers = [];
  plan.processes[0].processesPerReplica = 4;
  const result = evaluateConnectionBudget(plan);
  assert.equal(result.required, 147); // 12 processes * (10 pooled + 1 listener) + 5 ops + 10 headroom
  assert.equal(result.passed, false);
});
test('unbounded, fractional, duplicate and unknown budget declarations fail closed', () => {
  for (const mutate of [p => { p.poolers[0].databases[0].maxConnections = 0; },
    p => { p.primary.maxConnections = 1.5; }, p => { p.processes[0].replicas = -1; },
    p => { p.processes.push(structuredClone(p.processes[0])); }, p => { p.primary.unknown = 10; },
    p => { p.poolers = []; }]) {
    const plan = copy(); mutate(plan); assert.throws(() => evaluateConnectionBudget(plan));
  }
});
test('INI drift, wildcard aliases, disabled prepared statements and user overrides are rejected', () => {
  const pooler = copy().poolers[0];
  for (const changed of [ini.replace('max_db_connections = 30', 'max_db_connections = 60'),
    ini.replace('max_db_connections = 30', 'max_db_connections = 0'),
    ini.replace('max_client_conn = 200', 'max_client_conn = 199'),
    ini.replace('max_prepared_statements = 200', 'max_prepared_statements = 0'),
    ini.replace('pool_mode = transaction', 'pool_mode = session'),
    ini.replace('tluscholar = host', '* = host'), ini + '\n[users]\ntlu = pool_mode=session\n',
    ini.replace('dbname=tluscholar', 'dbname=tluscholar max_db_connections=0'),
    ini.replace('dbname=tluscholar', 'dbname=tluscholar max_db_connections=30 max_db_connections=60')]) {
    assert.throws(() => verifyPoolerConfig(changed, pooler));
  }
});

test('deployment routes app through pooler, keeps migrator direct and matches the declared API pool size', async () => {
  const compose = parse(await readFile(new URL('../../../deploy/compose.pgbouncer.yml', import.meta.url), 'utf8'));
  const runtime = compose.services.backend.environment, migrator = compose.services['backend-migrate'].environment;
  assert.equal(Number(runtime.DB_POOL_MAX), example.processes.find(item => item.name === 'api').poolMax);
  assert.equal(runtime.DB_POOL_MODE, 'transaction'); assert.equal(migrator.DB_POOL_MODE, 'direct');
  assert.equal(migrator.DATABASE_URL, runtime.DIRECT_DATABASE_URL);
  assert.equal(migrator.DIRECT_DATABASE_URL, runtime.DIRECT_DATABASE_URL);
  assert.match(runtime.DATABASE_URL, /POOLED_DATABASE_URL/);
  assert.equal(compose.services.pgbouncer.ports, undefined);
  assert.equal(compose.services.pgbouncer.read_only, true);
  const rollback = parse(await readFile(new URL('../../../deploy/compose.direct.yml', import.meta.url), 'utf8'));
  assert.equal(rollback.services.backend.environment.DB_POOL_MODE, 'direct');
  assert.equal(Number(rollback.services.backend.environment.DB_POOL_MAX), example.processes.find(item => item.name === 'api').poolMax);
  assert.match(rollback.services.backend.environment.DATABASE_URL, /DIRECT_DATABASE_URL/);
  assert.equal(rollback.services.backend.depends_on, undefined);
});
