import assert from 'node:assert/strict';
import { rm, unlink, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

export const BROWSER_FIXTURE_DATABASE = /^codex_browser_([a-f0-9]{16})$/;

export interface BrowserFixtureMetadata {
  database: string;
  directory: string;
  cacheDir?: string;
  pid?: number;
  ports?: number[];
  databaseServer?: { hostname: string; port: string };
}

export function fixturePaths(backend: string, metadata: BrowserFixtureMetadata) {
  const match = BROWSER_FIXTURE_DATABASE.exec(metadata.database);
  assert(match, 'Not a browser fixture database');
  const directory = resolve(backend, 'tmp', metadata.database);
  const cacheDir = resolve(backend, '../Frontendtluscholareditor/node_modules', `.vite-browser-${match[1]}`);
  assert.equal(resolve(metadata.directory), directory, 'Fixture directory does not match its database');
  if (metadata.cacheDir !== undefined) assert.equal(resolve(metadata.cacheDir), cacheDir, 'Unexpected fixture cache directory');
  return { directory, cacheDir, sessionPath: join(directory, 'session.json') };
}

export function databaseServer(url: string) {
  const parsed = new URL(url);
  assert(['postgres:', 'postgresql:'].includes(parsed.protocol), 'Expected a PostgreSQL URL');
  return { hostname: parsed.hostname, port: parsed.port || '5432' };
}

export function assertSeparateDatabase(url: string, metadata: BrowserFixtureMetadata) {
  assert(BROWSER_FIXTURE_DATABASE.test(metadata.database), 'Not a browser fixture database');
  assert.notEqual(decodeURIComponent(new URL(url).pathname.slice(1)), metadata.database, 'Refusing to drop the application database');
  if (metadata.databaseServer) assert.deepEqual(databaseServer(url), metadata.databaseServer, 'Database server differs from fixture metadata');
}

export async function removeFixtureCredentials(backend: string, metadata: BrowserFixtureMetadata) {
  const { sessionPath } = fixturePaths(backend, metadata);
  await unlink(sessionPath).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; });
}

export async function removeFixtureArtifacts(backend: string, metadata: BrowserFixtureMetadata) {
  const { directory, cacheDir } = fixturePaths(backend, metadata);
  // Every resolved target is constructed from the guarded fixture root, never from arbitrary manifest paths.
  for (const target of [cacheDir, join(directory, 'storage'), join(directory, 'templates'), join(directory, 'vite-cache')]) {
    await rm(target, { recursive: true, force: true });
  }
}

export async function writeCleanupReport(backend: string, metadata: BrowserFixtureMetadata, failedSteps: string[], recovery = false) {
  const { directory } = fixturePaths(backend, metadata);
  await writeFile(join(directory, 'cleanup.json'), JSON.stringify({ database: metadata.database,
    cleanedUp: failedSteps.length === 0, failedSteps, recovery, at: new Date().toISOString() }, null, 2));
}
