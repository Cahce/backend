import assert from 'node:assert/strict';
import { readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';

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

/** Test-only transport interruption. The real authentication/replay handlers remain authoritative. */
export async function installFixtureRealtimeControl(server: Server, backend: string, metadata: BrowserFixtureMetadata) {
  const { directory } = fixturePaths(backend, metadata);
  assert.deepEqual(metadata.ports, [3031, 5180], 'Unexpected browser fixture ports');
  assert(!server.listening, 'Install fixture control before listening');
  type UpgradeHandler = (request: IncomingMessage, socket: Duplex, head: Buffer) => void;
  const original = server.listeners('upgrade') as UpgradeHandler[];
  assert.equal(original.length, 1, 'Expected the real project realtime upgrade handler');
  const markerPath = join(directory, 'REALTIME_OUTAGE.json');
  const statusPath = join(directory, 'realtime-control.json');
  const sockets = new Set<Duplex>();
  let pausedUntil = 0, droppedSockets = 0, rejectedUpgrades = 0, stopped = false;
  let lastOutageStartedAt: string | null = null, lastOutageResumesAt: string | null = null;
  let lastControlError: string | null = null;
  const publish = () => writeFile(statusPath, JSON.stringify({
    state: stopped ? 'stopped' : Date.now() < pausedUntil ? 'outage' : 'live',
    connectedSockets: sockets.size, droppedSockets, rejectedUpgrades,
    lastOutageStartedAt, lastOutageResumesAt, lastControlError, updatedAt: new Date().toISOString(),
  }, null, 2));
  const wrapper: UpgradeHandler = (request, socket, head) => {
    const projectRealtime = /^\/api\/v1\/projects\/[^/?]+\/realtime$/.test(request.url ?? '');
    if (projectRealtime && Date.now() < pausedUntil) {
      rejectedUpgrades++;
      socket.end('HTTP/1.1 503 Service Unavailable\r\nRetry-After: 1\r\nConnection: close\r\n\r\n');
      return;
    }
    if (projectRealtime) {
      sockets.add(socket);
      socket.once('close', () => sockets.delete(socket));
    }
    for (const handler of original) handler.call(server, request, socket, head);
  };
  server.removeListener('upgrade', original[0]);
  server.on('upgrade', wrapper);
  try { await publish(); }
  catch (error) {
    server.removeListener('upgrade', wrapper);
    server.on('upgrade', original[0]);
    throw error;
  }
  return {
    markerPath, statusPath,
    async poll() {
      if (stopped) return;
      let marker: string | undefined;
      try { marker = await readFile(markerPath, 'utf8'); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      if (marker !== undefined) {
        // Consume once; a second outage requires creating a new marker. Never record marker contents.
        await unlink(markerPath);
        let durationMs: unknown;
        try { durationMs = JSON.parse(marker)?.durationMs; } catch { /* rejected below */ }
        if (typeof durationMs === 'number' && Number.isSafeInteger(durationMs) && durationMs >= 1000 && durationMs <= 120_000) {
          const now = Date.now();
          pausedUntil = now + durationMs;
          lastOutageStartedAt = new Date(now).toISOString();
          lastOutageResumesAt = new Date(pausedUntil).toISOString();
          lastControlError = null;
          for (const socket of sockets) { droppedSockets++; socket.destroy(); }
        } else lastControlError = 'Expected durationMs to be an integer between 1000 and 120000';
      }
      // The wrapper also checks the deadline, so upgrades resume even if a later status write fails.
      await publish();
    },
    async close() {
      stopped = true; pausedUntil = 0;
      server.removeListener('upgrade', wrapper);
      server.on('upgrade', original[0]);
      await unlink(markerPath).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; });
      await publish();
    },
  };
}
