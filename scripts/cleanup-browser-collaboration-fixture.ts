/** Recover only an inactive browser fixture after an abrupt process exit.
 * npx tsx scripts/cleanup-browser-collaboration-fixture.ts tmp/codex_browser_<16 hex>
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { connect } from 'node:net';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { assertSeparateDatabase, fixturePaths, removeFixtureArtifacts, removeFixtureCredentials, writeCleanupReport } from './fixtures/browser-fixture-lifecycle.js';
import type { BrowserFixtureMetadata } from './fixtures/browser-fixture-lifecycle.js';

const backend = fileURLToPath(new URL('..', import.meta.url));
const directoryArgument = process.argv[2];
assert(directoryArgument, 'Supply the exact inactive fixture directory');
const directory = resolve(directoryArgument);
let metadata: BrowserFixtureMetadata;
try { metadata = JSON.parse(await readFile(join(directory, 'fixture.json'), 'utf8')); }
catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  // Legacy fixtures only wrote session.json after becoming ready. Never print its credentials.
  const legacy = JSON.parse(await readFile(join(directory, 'session.json'), 'utf8'));
  metadata = { database: legacy.database, directory: legacy.directory, cacheDir: legacy.cacheDir,
    pid: legacy.pid, ports: legacy.ports, databaseServer: legacy.databaseServer };
}
const paths = fixturePaths(backend, metadata);
assert.equal(directory, paths.directory, 'Argument must match the guarded fixture directory');
if (metadata.pid !== undefined) {
  assert(Number.isSafeInteger(metadata.pid) && metadata.pid > 0, 'Invalid fixture PID');
  let alive = true;
  try { process.kill(metadata.pid, 0); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') alive = false; else throw error; }
  assert(!alive, 'Fixture PID is still alive; stop it normally first');
}
const isListening = (port: number, host: string) => new Promise<boolean>((resolveProbe, reject) => {
  const socket = connect({ port, host });
  socket.once('connect', () => { socket.destroy(); resolveProbe(true); });
  socket.once('error', (error: NodeJS.ErrnoException) => {
    socket.destroy(); if (error.code === 'ECONNREFUSED') resolveProbe(false); else reject(error);
  });
  socket.setTimeout(1500, () => { socket.destroy(); reject(new Error('Port probe timed out; recovery refused')); });
});
const ports = metadata.ports ?? [3031, 5180];
assert.deepEqual(ports, [3031, 5180], 'Unexpected fixture ports');
for (const port of ports) for (const host of ['127.0.0.1', '::1']) {
  assert(!(await isListening(port, host)), `Fixture port ${port} is still listening`);
}
const url = process.env.DIRECT_DATABASE_URL?.trim() || process.env.DATABASE_URL;
assert(url, 'DATABASE_URL is required');
assertSeparateDatabase(url, metadata);
// Preserve non-secret recovery metadata before credentials are removed, including for legacy fixtures/retries.
await writeFile(join(paths.directory, 'fixture.json'), JSON.stringify(metadata, null, 2));
const admin = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 });
const errors: unknown[] = [], failedSteps: string[] = [];
const attempt = async (name: string, work: () => Promise<unknown>) => {
  try { await work(); } catch (error) { errors.push(error); failedSteps.push(name); }
};
// Refusal checks finish before any destructive cleanup. Keep artifacts intact if another connection is using this DB.
try {
  await admin.connect();
  const active = await admin.query('SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = $1', [metadata.database]);
  assert.equal(active.rows[0].count, 0, 'Fixture database has active connections; recovery refused');
} catch (error) {
  await admin.end();
  throw error;
}
try {
  await attempt('database', () => admin.query(`DROP DATABASE IF EXISTS "${metadata.database}"`));
} finally {
  await attempt('admin', () => admin.end());
  await attempt('credentials', () => removeFixtureCredentials(backend, metadata));
  await attempt('artifacts', () => removeFixtureArtifacts(backend, metadata));
  await attempt('report', () => writeCleanupReport(backend, metadata, failedSteps, true));
}
if (errors.length) throw new AggregateError(errors, 'Browser fixture recovery incomplete');
console.log(`Recovered inactive fixture ${metadata.database}; temporary database, credentials and artifacts removed.`);
