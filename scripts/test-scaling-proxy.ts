/** Run against a supplied Nginx binary; isolates ports/files and never touches app data. */
import { RealtimeSocketLeases } from '../src/modules/project-discussion/application/RealtimeSocketLeases.js';
import { LocalRealtimeSocketLeaseStore } from '../src/modules/project-discussion/infra/LocalRealtimeSocketLeaseStore.js';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import Fastify from 'fastify';
import { WebSocket } from 'ws';
import { lifecyclePlugin } from '../src/plugins/Lifecycle.js';
import { healthRoutes } from '../src/api/health.js';
import { registerProjectRealtime } from '../src/modules/project-discussion/delivery/ws/ProjectRealtime.js';

const nginx = process.argv[2];
assert(nginx, 'Usage: npx tsx scripts/test-scaling-proxy.ts <absolute-or-relative-nginx-binary>');
const binary = resolve(nginx);
const scratchRoot = resolve('tmp');
await mkdir(scratchRoot, { recursive: true });
const sandbox = await mkdtemp(join(scratchRoot, 'nginx-capacity-'));
const prefix = sandbox.replaceAll('\\', '/') + '/';
const configuration = join(sandbox, 'nginx.conf');
const app = Fastify();
let processHandle: ReturnType<typeof spawn> | undefined;
let client: WebSocket | undefined;
const ticket = randomBytes(32).toString('base64url');
const origin = 'https://capacity-proxy.test';

async function command(args: string[]) {
  const child = spawn(binary, ['-p', prefix, '-c', configuration, ...args], { cwd: sandbox, windowsHide: true });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const [code] = await once(child, 'exit');
  assert.equal(code, 0, output);
}

try {
  await app.register(lifecyclePlugin, { probe: { async check() {} } });
  await app.register(healthRoutes);
  app.get('/api/v1/probe', async () => ({ ok: true }));
  registerProjectRealtime(app, {
    async consume(projectId, candidate) {
      assert.equal(projectId, 'fixture'); assert.equal(candidate, ticket);
      return { projectId, actor: { userId: 'fixture-user', role: 'student' },
        jti: randomBytes(16).toString('hex'), expiresAt: Date.now() + 60000 };
    },
    async validate() { return true; },
  }, { async events() { return { events: [], nextCursor: '0', highWatermark: '0', hasMore: false }; } }, [origin],
  new RealtimeSocketLeases(new LocalRealtimeSocketLeaseStore(), () => randomBytes(16).toString('hex')));
  const backendUrl = await app.listen({ host: '127.0.0.1', port: 0 });
  const portProbe = createServer(); portProbe.listen(0, '127.0.0.1'); await once(portProbe, 'listening');
  const address = portProbe.address(); assert(address && typeof address !== 'string');
  const proxyPort = address.port;
  await new Promise<void>((done, reject) => portProbe.close(error => error ? reject(error) : done()));

  await mkdir(join(sandbox, 'logs')); await mkdir(join(sandbox, 'public')); await mkdir(join(sandbox, 'temp'));
  await writeFile(join(sandbox, 'public', 'index.html'), '<html>proxy fixture</html>');
  const source = await readFile(new URL('../../Frontendtluscholareditor/deploy/nginx.conf', import.meta.url), 'utf8');
  assert(source.includes('listen 80;') && source.includes('http://backend:3000'));
  const site = source.replace('listen 80;', `listen 127.0.0.1:${proxyPort};`)
    .replaceAll('http://backend:3000', backendUrl)
    .replace('root /usr/share/nginx/html;', `root "${prefix}public";`);
  // Exercise the checked-in conf.d file, not the documentation's sample config.
  await writeFile(configuration, `worker_processes 1;\nevents { worker_connections 128; }\nhttp {\n${site}\n}\n`);
  await command(['-t']);
  processHandle = spawn(binary, ['-p', prefix, '-c', configuration], { cwd: sandbox, windowsHide: true, stdio: 'ignore' });
  const proxyUrl = `http://127.0.0.1:${proxyPort}`;
  let started = false;
  for (let i = 0; i < 50; i++) {
    try { started = (await fetch(`${proxyUrl}/api/v1/probe`, { signal: AbortSignal.timeout(500) })).ok; } catch {}
    if (started) break;
    await delay(100);
  }
  assert(started, 'Nginx did not accept a proxied HTTP request');
  assert.equal((await fetch(`${proxyUrl}/health/ready`)).status, 200);
  client = new WebSocket(`${proxyUrl.replace('http:', 'ws:')}/api/v1/projects/fixture/realtime`, { origin });
  let receivedReady = false, pings = 0;
  const ready = new Promise<void>((done, reject) => {
    const timeout = setTimeout(() => reject(new Error('No authenticated ready frame through Nginx')), 5000);
    client!.on('error', reject);
    client!.on('message', data => {
      if (JSON.parse(data.toString()).type === 'ready') { receivedReady = true; clearTimeout(timeout); done(); }
    });
  });
  client.on('ping', () => { pings++; });
  await once(client, 'open');
  client.send(JSON.stringify({ type: 'authenticate', ticket, since: '0' }));
  await ready;
  const bad = new WebSocket(`${proxyUrl.replace('http:', 'ws:')}/api/v1/projects/fixture/realtime`, { origin: 'https://untrusted.test' });
  bad.on('error', () => {});
  const [request, rejected] = await once(bad, 'unexpected-response');
  assert.equal(rejected.statusCode, 403); rejected.resume(); request.destroy(); bad.terminate();
  await delay(31000);
  assert(receivedReady && pings >= 1 && client.readyState === WebSocket.OPEN, 'Heartbeat must survive the proxy');
  app.lifecycle.beginDrain();
  assert.equal((await fetch(`${proxyUrl}/health/ready`)).status, 503);
  assert.equal((await fetch(`${proxyUrl}/health/live`)).status, 200);
  assert.equal((await fetch(`${proxyUrl}/api/v1/probe`)).status, 503);
  const duringDrain = new WebSocket(`${proxyUrl.replace('http:', 'ws:')}/api/v1/projects/fixture/realtime`, { origin });
  duringDrain.on('error', () => {});
  const [drainRequest, drainResponse] = await once(duringDrain, 'unexpected-response');
  assert.equal(drainResponse.statusCode, 503);
  drainResponse.resume(); drainRequest.destroy(); duringDrain.terminate();
  const closed = once(client, 'close');
  await app.close();
  assert.equal((await closed)[0], 1012);
  console.log('PASS: checked-in Nginx config; HTTP; WS authentication/Origin/heartbeat; readiness503 and WS1012 during drain.');
} finally {
  client?.terminate();
  await app.close();
  if (processHandle) {
    await command(['-s', 'quit']);
    for (let i = 0; i < 50 && processHandle.exitCode === null; i++) await delay(100);
    assert.notEqual(processHandle.exitCode, null, 'Nginx must exit before scratch cleanup');
  }
  // Verify resolved ownership before recursively deleting only this generated sandbox.
  assert.equal(dirname(await realpath(sandbox)), await realpath(scratchRoot));
  await rm(sandbox, { recursive: true, force: true });
}
