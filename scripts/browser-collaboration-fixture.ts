/** Full local app for browser QA. No application data or credentials are modified.
 * npx tsx scripts/browser-collaboration-fixture.ts
 * Stop by creating the printed fixture directory's STOP file (or Ctrl+C).
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { PasswordHasherBcrypt } from '../src/modules/auth/infra/PasswordHasherBcrypt.js';
import { assertSeparateDatabase, databaseServer, fixturePaths, removeFixtureArtifacts, removeFixtureCredentials, writeCleanupReport } from './fixtures/browser-fixture-lifecycle.js';
import type { BrowserFixtureMetadata } from './fixtures/browser-fixture-lifecycle.js';

const backend = fileURLToPath(new URL('..', import.meta.url));
const frontend = resolve(backend, '../Frontendtluscholareditor');
const suffix = randomBytes(8).toString('hex');
const database = `codex_browser_${suffix}`;
assert.match(database, /^codex_browser_[a-f0-9]{16}$/);
const directory = resolve(backend, 'tmp', database);
const sessionPath = join(directory, 'session.json');
const controlPath = join(directory, 'STOP');
const originalUrl = process.env.DIRECT_DATABASE_URL?.trim() || process.env.DATABASE_URL;
assert(originalUrl, 'DATABASE_URL is required');
const metadata: BrowserFixtureMetadata = { database, directory, pid: process.pid, ports: [3031, 5180],
  databaseServer: databaseServer(originalUrl) };
metadata.cacheDir = fixturePaths(backend, metadata).cacheDir;
assertSeparateDatabase(originalUrl, metadata);
const fixtureUrl = new URL(originalUrl);
assert.notEqual(fixtureUrl.pathname, `/${database}`);
fixtureUrl.pathname = `/${database}`;
fixtureUrl.searchParams.delete('schema');
fixtureUrl.searchParams.delete('options');
const admin = new pg.Client({ connectionString: originalUrl, connectionTimeoutMillis: 5000 });
let created = false;
let app: Awaited<ReturnType<typeof import('../src/app.js')['buildApp']>> | undefined;
let vite: { close(): Promise<void> } | undefined;
let resolveStop: () => void = () => {};
const stop = new Promise<void>(resolve => { resolveStop = resolve; });
const onStop = () => resolveStop();
process.once('SIGINT', onStop);
process.once('SIGTERM', onStop);
const deadline = setTimeout(onStop, 45 * 60_000);
let checking = false;
let directoryCreated = false;
const marker = setInterval(async () => {
  if (checking) return;
  checking = true;
  try { await access(controlPath); onStop(); } catch { /* no stop request */ }
  finally { checking = false; }
}, 1000);

try {
  await mkdir(directory, { recursive: true });
  directoryCreated = true;
  // Non-secret recovery information exists before database/server startup, including if the process is killed.
  await writeFile(join(directory, 'fixture.json'), JSON.stringify(metadata, null, 2));
  await admin.connect();
  await admin.query(`CREATE DATABASE "${database}"`);
  created = true;
  const setup = new pg.Client({ connectionString: fixtureUrl.toString(), connectionTimeoutMillis: 5000 });
  try {
    await setup.connect();
    assert.equal((await setup.query('SELECT current_database() AS name')).rows[0].name, database);
    await setup.query(await readFile(new URL('./fixtures/project-sharing-baseline.sql', import.meta.url), 'utf8'));
    await setup.query(await readFile(new URL('../prisma/migrations/20261003000000_project_sharing_and_chat/migration.sql', import.meta.url), 'utf8'));
  } finally { await setup.end(); }

  Object.assign(process.env, {
    DATABASE_URL: fixtureUrl.toString(), DIRECT_DATABASE_URL: fixtureUrl.toString(), DB_POOL_MODE: 'direct',
    HOST: '127.0.0.1', PORT: '3031', JWT_SECRET: randomBytes(32).toString('hex'),
    PROJECT_SHARING_ENABLED: 'true', PROJECT_REALTIME_ORIGINS: 'http://localhost:5180,http://127.0.0.1:5180',
    SHARED_STATE_DRIVER: 'local', METRICS_ENABLED: 'false', BLOB_STORAGE_DRIVER: 'local',
    STORAGE_DIR: join(directory, 'storage'), TEMPLATE_STORAGE_DIR: join(directory, 'templates'),
    VITE_API_BASE_URL: 'http://127.0.0.1:3031/api/v1', VITE_PROJECT_SHARING_ENABLED: 'true',
  });
  delete process.env.CORS_ORIGIN; // The app reflects browser origins; this fixture binds loopback only.
  const { config } = await import('../src/config/index.js');
  assert.equal(new URL(config.db.url).pathname, `/${database}`);
  const { buildApp } = await import('../src/app.js');
  app = await buildApp();
  const password = randomBytes(24).toString('base64url');
  const passwordHash = await new PasswordHasherBcrypt().hash(password);
  const accounts: Record<string, { id: string; email: string }> = {};
  for (const [name, role] of [['owner', 'student'], ['viewer', 'student'], ['commenter', 'teacher'], ['editor', 'student'], ['admin', 'admin']] as const) {
    const email = `browser-${name}@${role === 'student' ? 'e.tlu.edu.vn' : 'tlu.edu.vn'}`;
    const user = await app.prisma.user.create({ data: { email, role, passwordHash } });
    accounts[name] = { id: user.id, email };
  }
  const project = await app.prisma.project.create({ data: { title: 'QA chia sẻ và chat — dữ liệu tạm', category: 'other', ownerId: accounts.owner.id } });
  await app.prisma.projectCollaborationState.create({ data: { projectId: project.id } });
  await app.prisma.projectSettings.create({ data: { projectId: project.id, mainPath: 'main.typ' } });
  await app.prisma.file.create({ data: { projectId: project.id, path: 'main.typ', kind: 'typst',
    textContent: '= Kiểm thử cộng tác\n\nNội dung mẫu để kiểm tra chia sẻ, nhận xét và chỉnh sửa.\n' } });
  await app.listen({ host: '127.0.0.1', port: 3031 });

  // Load this repository's Vite, retaining its real plugins/config and using an isolated optimizer cache.
  const { createServer } = await import(pathToFileURL(join(frontend, 'node_modules/vite/dist/node/index.js')).href);
  // Excluded Typst packages resolve relative to optimized files, so keep the unique cache under the frontend.
  const server = await createServer({ root: frontend, cacheDir: metadata.cacheDir,
    server: { host: '127.0.0.1', port: 5180, strictPort: true, open: false } });
  vite = server;
  await server.listen();
  await writeFile(sessionPath, JSON.stringify({ ...metadata, projectId: project.id, accounts, password,
    frontend: 'http://localhost:5180', memberFrontend: 'http://127.0.0.1:5180', api: 'http://127.0.0.1:3031' }, null, 2), { mode: 0o600 });
  console.log(`Browser fixture ready. Session metadata: ${sessionPath}. Stop marker: ${controlPath}`);
  await stop;
} finally {
  clearInterval(marker); clearTimeout(deadline);
  process.off('SIGINT', onStop); process.off('SIGTERM', onStop);
  const cleanupErrors: unknown[] = [];
  const failedSteps: string[] = [];
  const attempt = async (name: string, work: () => Promise<unknown>) => {
    try { await work(); } catch (error) { cleanupErrors.push(error); failedSteps.push(name); }
  };
  // Remove credentials first, even if a later server/database cleanup step fails.
  await attempt('credentials', () => removeFixtureCredentials(backend, metadata));
  await attempt('vite', async () => vite?.close());
  await attempt('app', async () => app?.close());
  if (created) {
    await attempt('database', () => {
      assertSeparateDatabase(originalUrl, metadata);
      return admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    });
  }
  await attempt('admin', () => admin.end());
  if (directoryCreated) {
    await attempt('artifacts', () => removeFixtureArtifacts(backend, metadata));
    await attempt('report', () => writeCleanupReport(backend, metadata, failedSteps));
  }
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Browser fixture cleanup incomplete');
  console.log('Browser fixture closed; temporary database and credentials removed.');
}
