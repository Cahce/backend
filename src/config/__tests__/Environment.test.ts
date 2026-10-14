import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

function readLimits(overrides: Record<string, string>) {
  return spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
    `const {config}=await import('./src/config/index.ts'); console.log(JSON.stringify({enabled:config.compile.workerEnabled, capacity:config.compile.maxOutstandingJobs, poolMax:config.db.poolMax, acquireTimeout:config.db.connectionTimeoutMs, directUrl:config.db.directUrl, poolMode:config.db.poolMode}));`],
  { cwd: process.cwd(), encoding: 'utf8', windowsHide: true, env: { ...process.env,
    DATABASE_URL: 'postgresql://localhost:5432/test', JWT_SECRET: randomBytes(32).toString('hex'),
    DB_POOL_MODE: 'direct', DIRECT_DATABASE_URL: '', SHUTDOWN_DRAIN_MS: '3000', SHUTDOWN_TIMEOUT_MS: '40000',
    METRICS_ENABLED: 'false', METRICS_TOKEN: '',
    SHARED_STATE_DRIVER: 'local', REDIS_URL: '', REDIS_KEY_SECRET: '', REDIS_NAMESPACE: 'tlu-test',
    REDIS_COMMAND_TIMEOUT_MS: '500', REDIS_CONNECT_TIMEOUT_MS: '2000', REDIS_MAX_PENDING: '256',
    REALTIME_MAX_SOCKETS_PER_INSTANCE: '200', REALTIME_MAX_SOCKETS_GLOBAL: '10000',
    AUTH_PASSWORD_CONCURRENCY: '4', AUTH_PASSWORD_MAX_OUTSTANDING: '128', AUTH_PASSWORD_QUEUE_WAIT_MS: '5000',
    AUTH_LOGIN_IP_PER_MINUTE: '12000', AUTH_LOGIN_PAIR_PER_MINUTE: '10', AUTH_CHANGE_PASSWORD_PER_MINUTE: '5', TRUST_PROXY_CIDRS: '',
    COMPILE_WORKER_ENABLED: 'true', COMPILE_MAX_OUTSTANDING_JOBS: '32', DB_POOL_MAX: '10', DB_CONNECTION_TIMEOUT_MS: '5000', ...overrides } });
}

test('compile worker flag parses textual false, and bounded limits remain numeric', () => {
  const result = readLimits({ COMPILE_WORKER_ENABLED: 'false' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()), { enabled: false, capacity: 32, poolMax: 10, acquireTimeout: 5000,
    directUrl: 'postgresql://localhost:5432/test', poolMode: 'direct' });
});
test('compile worker true and custom validated limits', () => {
  const result = readLimits({ COMPILE_MAX_OUTSTANDING_JOBS: '16', DB_POOL_MAX: '12', DB_CONNECTION_TIMEOUT_MS: '3000' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()), { enabled: true, capacity: 16, poolMax: 12, acquireTimeout: 3000,
    directUrl: 'postgresql://localhost:5432/test', poolMode: 'direct' });
});

test('transaction pooling requires a separate configured direct URL for listener and CLI', () => {
  assert.notEqual(readLimits({ DB_POOL_MODE: 'transaction' }).status, 0);
  const valid = readLimits({ DB_POOL_MODE: 'transaction', DIRECT_DATABASE_URL: 'postgresql://primary:5432/test' });
  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(JSON.parse(valid.stdout.trim()).directUrl, 'postgresql://primary:5432/test');
});

test('shutdown deadline must leave time after the drain delay', () => {
  assert.notEqual(readLimits({ SHUTDOWN_DRAIN_MS: '1000', SHUTDOWN_TIMEOUT_MS: '1000' }).status, 0);
});

test('metrics are opt-in and require a dedicated non-empty token when enabled', () => {
  assert.notEqual(readLimits({ METRICS_ENABLED: 'true' }).status, 0);
  assert.notEqual(readLimits({ METRICS_TOKEN: ' '.repeat(40) , METRICS_ENABLED: 'true' }).status, 0);
  assert.notEqual(readLimits({ METRICS_ENABLED: 'yes' }).status, 0);
  assert.equal(readLimits({ METRICS_ENABLED: 'true', METRICS_TOKEN: randomBytes(32).toString('hex') }).status, 0);
});
test('invalid worker flags and unbounded or fractional capacities are rejected', () => {
  const invalid: Record<string, string>[] = [{ COMPILE_WORKER_ENABLED: 'yes' }, { COMPILE_MAX_OUTSTANDING_JOBS: '0' },
    { DB_POOL_MAX: '1.5' }, { DB_CONNECTION_TIMEOUT_MS: '0' }];
  for (const overrides of invalid) {
    assert.notEqual(readLimits(overrides).status, 0);
  }
});

test('Redis opt-in requires URL/key secret and bounded namespace/queue/deadlines', () => {
  assert.notEqual(readLimits({ SHARED_STATE_DRIVER: 'redis' }).status, 0);
  const redis = { SHARED_STATE_DRIVER: 'redis', REDIS_URL: 'redis://localhost:6379', REDIS_KEY_SECRET: randomBytes(32).toString('hex') };
  assert.equal(readLimits(redis).status, 0);
  const invalidValues: Record<string, string>[] = [{ REDIS_URL: 'https://localhost' }, { REDIS_KEY_SECRET: '' }, { REDIS_MAX_PENDING: '0' },
    { REDIS_MAX_PENDING: '1.5' }, { REDIS_COMMAND_TIMEOUT_MS: '0' }, { REDIS_NAMESPACE: 'bad:{namespace}' }];
  for (const invalid of invalidValues) {
    assert.notEqual(readLimits({ ...redis, ...invalid }).status, 0);
  }
});

test('socket limits are finite and an instance cannot exceed global capacity', () => {
  assert.equal(readLimits({ REALTIME_MAX_SOCKETS_PER_INSTANCE: '1000' }).status, 0);
  assert.notEqual(readLimits({ REALTIME_MAX_SOCKETS_GLOBAL: '100' }).status, 0);
  assert.notEqual(readLimits({ REALTIME_MAX_SOCKETS_PER_INSTANCE: '0' }).status, 0);
  assert.notEqual(readLimits({ REALTIME_MAX_SOCKETS_GLOBAL: '10000.5' }).status, 0);
});

test('auth work/rate config rejects unbounded values and unsafe proxy trust', () => {
  const invalidValues: Record<string, string>[] = [{ AUTH_PASSWORD_CONCURRENCY: '0' }, { AUTH_PASSWORD_CONCURRENCY: '33' },
    { AUTH_PASSWORD_CONCURRENCY: '4', AUTH_PASSWORD_MAX_OUTSTANDING: '3' }, { AUTH_PASSWORD_MAX_OUTSTANDING: '1025' },
    { AUTH_PASSWORD_QUEUE_WAIT_MS: '0' }, { AUTH_PASSWORD_QUEUE_WAIT_MS: '30001' },
    { AUTH_LOGIN_PAIR_PER_MINUTE: '0' }, { AUTH_LOGIN_IP_PER_MINUTE: '1.5' }, { AUTH_CHANGE_PASSWORD_PER_MINUTE: '1000001' },
    { TRUST_PROXY_CIDRS: 'true' }, { TRUST_PROXY_CIDRS: '0.0.0.0/0' }];
  for (const invalid of invalidValues) assert.notEqual(readLimits(invalid).status, 0);
  assert.equal(readLimits({ AUTH_PASSWORD_CONCURRENCY: '2', AUTH_PASSWORD_MAX_OUTSTANDING: '16', TRUST_PROXY_CIDRS: '127.0.0.1,::1' }).status, 0);
});
