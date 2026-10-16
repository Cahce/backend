/**
 * Reproducible local capacity measurement. Example:
 * npx tsx scripts/load-system-capacity.ts --label baseline --seconds 60
 * Uses a generated scratch schema, actual module HTTP routes, and 100 distinct logins.
 * The child server and traffic generator are separate processes on the same host.
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { fork, type ChildProcess } from 'node:child_process';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFile, mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir, cpus, totalmem, platform, release } from 'node:os';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import pg from 'pg';
import { WebSocket } from 'ws';
import type { FixtureUser } from './load-system-capacity-worker.js';

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const label = option('label', 'baseline'), seconds = Number(option('seconds', '60'));
const userCount = Number(option('users', '100')), projectCount = Number(option('projects', '20'));
const fileBytes = Number(option('file-bytes', '16384')), poolMax = Number(option('pool-max', '10'));
const poolTimeoutMs = Number(option('pool-timeout-ms', '5000'));
const instrumentation = option('instrumentation', 'false');
assert(['true', 'false'].includes(instrumentation));
assert.match(label, /^[a-z0-9_-]{1,40}$/);
assert(Number.isInteger(seconds) && seconds >= 5 && seconds <= 1800);
assert(Number.isInteger(userCount) && userCount >= 5 && userCount <= 100 && userCount % projectCount === 0);
assert(Number.isInteger(fileBytes) && fileBytes >= 128 && fileBytes <= 128 * 1024);
assert(Number.isInteger(poolMax) && poolMax >= 2 && poolMax <= 30);
assert(Number.isInteger(poolTimeoutMs) && poolTimeoutMs >= 100 && poolTimeoutMs <= 60000);
const schema = `codex_load_${randomBytes(8).toString('hex')}`;
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${label}`;
const reportDir = fileURLToPath(new URL('../../.kiro/reports/system-capacity/', import.meta.url));
const outputPath = join(reportDir, `${runId}.json`);
const pause = (ms: number) => new Promise<void>(resolvePause => setTimeout(resolvePause, ms));
const summary = (values: number[]) => {
  const a = [...values].sort((x, y) => x - y), q = (p: number) => a.length ? Number(a[Math.min(a.length - 1, Math.ceil(a.length * p) - 1)].toFixed(3)) : 0;
  return { count: a.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: q(1), min: a.length ? a[0] : 0 };
};
type EndpointStats = { durationMs: number[]; statuses: Record<string, number>; errorCodes: Record<string, number>; bytes: number };
type User = FixtureUser & { token: string; ws?: WebSocket; cursor: string; seen: Set<string>; expectedClose: boolean; paused: boolean;
  latestChatSeq: string; chatTimer?: NodeJS.Timeout; fileTimer?: NodeJS.Timeout; changedFiles: Map<string, { path: string; revision: number }>;
  next: Record<string, number>; busy: Set<string>; readTurn: number; saveTurn: number };
type Mutation = { started: number; ack?: number; success: boolean; expected: Set<number>; received: Map<number, number>; kind: 'chat' | 'file' };
let phase = 'setup', base = '', child: ChildProcess | undefined, storageDir = '', running = false, stopping = false;
let users: User[] = [], maxSockets = 0, unexpectedCloses = 0, duplicateEvents = 0, forbiddenDeliveries = 0;
const metrics = new Map<string, EndpointStats>(), offered: Record<string, number> = {}, skipped: Record<string, number> = {};
const mutations = new Map<string, Mutation>(), pending = new Set<Promise<unknown>>(), driverErrors: Record<string, number> = {};
const scheduleLag: number[] = [], compileResults: { status: string; durationMs: number; pdfBytes?: number; validPdf?: boolean; pages?: number }[] = [];
const healthSamples = new Map<string, number[]>();
let healthTimer: NodeJS.Timeout | undefined, healthBusy = false, healthFailures = 0, healthSkipped = 0;
function startHealth() {
  healthTimer = setInterval(() => {
    if (healthBusy) { healthSkipped++; return; }
    healthBusy = true; const at = performance.now(), metric = phase;
    void fetch(`${base}/health`, { signal: AbortSignal.timeout(15_000) }).then(async response => {
      await response.arrayBuffer(); if (response.status !== 200) healthFailures++;
    }).catch(() => healthFailures++).finally(() => {
      const values = healthSamples.get(metric) ?? []; values.push(performance.now() - at); healthSamples.set(metric, values); healthBusy = false;
    });
  }, 100);
}
const endpoints = () => Object.fromEntries([...metrics.entries()].map(([name, m]) => [name,
  { latencyMs: summary(m.durationMs), statuses: m.statuses, errorCodes: m.errorCodes, bytes: m.bytes }]));
const track = (task: Promise<unknown>) => {
  pending.add(task);
  void task.catch(error => { const name = error instanceof Error ? error.name : 'UnknownError'; driverErrors[name] = (driverErrors[name] ?? 0) + 1; })
    .finally(() => pending.delete(task));
};
async function request(user: User | undefined, endpoint: string, method: string, path: string, body?: unknown, expected = [200, 201, 202, 204]) {
  const key = `${phase}/${endpoint}`, stats = metrics.get(key) ?? { durationMs: [], statuses: {}, errorCodes: {}, bytes: 0 };
  metrics.set(key, stats); offered[key] = (offered[key] ?? 0) + 1;
  const began = performance.now();
  try {
    const response = await fetch(`${base}/api/v1${path}`, { method, headers: {
      ...(user?.token ? { authorization: `Bearer ${user.token}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15_000) });
    const text = await response.text(); stats.bytes += Buffer.byteLength(text);
    let data: any; try { data = text ? JSON.parse(text) : undefined; } catch { data = undefined; }
    stats.statuses[String(response.status)] = (stats.statuses[String(response.status)] ?? 0) + 1;
    if (!expected.includes(response.status)) { const code = data?.error?.code ?? `HTTP_${response.status}`; stats.errorCodes[code] = (stats.errorCodes[code] ?? 0) + 1; }
    return { ok: expected.includes(response.status), status: response.status, data };
  } catch (error) {
    const code = error instanceof Error ? error.name : 'TransportError';
    stats.statuses.transportError = (stats.statuses.transportError ?? 0) + 1;
    stats.errorCodes[code] = (stats.errorCodes[code] ?? 0) + 1;
    return { ok: false, status: 0, data: undefined };
  } finally { stats.durationMs.push(performance.now() - began); }
}
function source(user: User) {
  const paragraph = 'This reproducible academic document measures collaborative storage and native PDF export under concurrent editing.\n\n';
  return `= Chapter ${user.index}, revision ${++user.saveTurn}\n` + paragraph.repeat(Math.ceil(fileBytes / paragraph.length)) +
    (user.index === user.ownerIndex ? users.filter(peer => peer.projectId === user.projectId && peer.index !== user.index)
      .map(peer => `\n#pagebreak()\n#include "${peer.path}"\n`).join('') : '');
}
function noteEvent(user: User, event: any) {
  if (user.seen.has(event.seq)) { duplicateEvents++; return; }
  user.seen.add(event.seq);
  const key = event.type === 'chat.message.created' ? `chat:${event.data?.message?.clientMessageId}` :
    event.type === 'project.file.updated' ? `file:${event.data?.fileId}:${event.data?.revision}` : '';
  const mutation = mutations.get(key);
  if (mutation && mutation.expected.has(user.index)) mutation.received.set(user.index, performance.now());
  if (!running || user.paused) return;
  if (event.type === 'chat.message.created') {
    if (BigInt(event.seq) > BigInt(user.latestChatSeq)) user.latestChatSeq = event.seq;
    // An open visible discussion panel marks the highest received message once per 100ms.
    if (!user.chatTimer) user.chatTimer = setTimeout(() => {
      user.chatTimer = undefined;
      if (running && !user.paused) track(request(user, 'fanout.read-state', 'PUT', `/projects/${user.projectId}/chat/read-state`, { lastReadMessageSeq: user.latestChatSeq }));
    }, 100);
  }
  if (event.type === 'project.file.updated') {
    user.changedFiles.set(event.data.fileId, { path: event.data.path, revision: event.data.revision });
    if (!user.fileTimer) user.fileTimer = setTimeout(() => {
      user.fileTimer = undefined;
      const changed = [...user.changedFiles.entries()]; user.changedFiles.clear();
      if (!running || user.paused) return;
      track((async () => {
        await request(user, 'fanout.files', 'GET', `/projects/${user.projectId}/files`);
        await Promise.all(changed.filter(([id]) => id !== user.fileId).map(([, file]) =>
          request(user, 'fanout.content', 'GET', `/projects/${user.projectId}/files/${encodeURIComponent(file.path)}`)));
      })());
    }, 25);
  }
}
async function connect(user: User) {
  const ticket = await request(user, 'realtime.ticket', 'POST', `/projects/${user.projectId}/realtime-ticket`);
  assert(ticket.ok && ticket.data?.ticket, `Ticket failed for user ${user.index}`);
  const ws = new WebSocket(`${base.replace('http:', 'ws:')}/api/v1/projects/${user.projectId}/realtime`, { origin: 'http://capacity.test' });
  user.ws = ws;
  await new Promise<void>((resolveReady, reject) => {
    const deadline = setTimeout(() => reject(new Error('WebSocket ready timeout')), 15_000);
    ws.on('open', () => ws.send(JSON.stringify({ type: 'authenticate', ticket: ticket.data.ticket, since: user.cursor })));
    ws.on('error', error => { clearTimeout(deadline); reject(error); });
    ws.on('message', raw => {
      const frame = JSON.parse(raw.toString());
      if (frame.type === 'ready') { clearTimeout(deadline); resolveReady(); }
      if (frame.type === 'events') { for (const event of frame.events) noteEvent(user, event); user.cursor = frame.nextCursor; }
    });
    ws.on('close', () => { clearTimeout(deadline); if (!stopping && !user.expectedClose) unexpectedCloses++; });
  });
  maxSockets = Math.max(maxSockets, users.filter(u => u.ws?.readyState === WebSocket.OPEN).length);
}

let rpcId = 0;
const replies = new Map<number, { resolve(value: any): void; reject(error: Error): void; timer: NodeJS.Timeout }>();
function rpc(command: string, input?: unknown): Promise<any> {
  return new Promise((resolveReply, reject) => {
    const id = ++rpcId, timer = setTimeout(() => { replies.delete(id); reject(new Error(`Worker ${command} timeout`)); }, 60_000);
    replies.set(id, { resolve: resolveReply, reject, timer }); child!.send({ id, command, input });
  });
}
async function sendChat(user: User) {
  const clientMessageId = randomUUID(), mutation: Mutation = { started: performance.now(), success: false,
    expected: new Set(users.filter(u => u.projectId === user.projectId && !u.paused).map(u => u.index)), received: new Map(), kind: 'chat' };
  mutations.set(`chat:${clientMessageId}`, mutation);
  const result = await request(user, 'chat.send', 'POST', `/projects/${user.projectId}/chat/messages`, { clientMessageId, body: `Capacity chat from ${user.index}` });
  mutation.ack = performance.now(); mutation.success = result.ok;
}
async function save(user: User) {
  const key = `file:${user.fileId}:${user.revision + 1}`, mutation: Mutation = { started: performance.now(), success: false,
    expected: new Set(users.filter(u => u.projectId === user.projectId && !u.paused).map(u => u.index)), received: new Map(), kind: 'file' };
  mutations.set(key, mutation);
  const result = await request(user, 'file.save', 'PUT', `/projects/${user.projectId}/files/${encodeURIComponent(user.path)}`,
    { content: source(user), fileId: user.fileId, baseRevision: user.revision });
  mutation.ack = performance.now(); mutation.success = result.ok;
  if (result.ok) user.revision = result.data.revision;
}
async function read(user: User) {
  const routes = [ ['read.metadata', `/projects/${user.projectId}`], ['read.dashboard', user.index === user.ownerIndex ? '/projects' : '/projects/shared'],
    ['read.files', `/projects/${user.projectId}/files`] ];
  const [endpoint, path] = routes[user.readTurn++ % routes.length];
  await request(user, endpoint, 'GET', path);
}
async function compile(user: User) {
  const began = performance.now(), submitted = await request(user, 'compile.enqueue', 'POST', `/projects/${user.projectId}/compile`, { entryPath: 'main.typ', engine: 'node', format: 'pdf' });
  if (!submitted.ok) { compileResults.push({ status: `http_${submitted.status}`, durationMs: performance.now() - began }); return; }
  let status = submitted.data.job.status;
  while (!['success', 'failed'].includes(status) && performance.now() - began < 65_000) {
    await pause(1000);
    const polled = await request(user, 'compile.status', 'GET', `/projects/${user.projectId}/compile/${submitted.data.job.id}`);
    if (polled.ok) status = polled.data.job.status; else break;
  }
  let pdfBytes: number | undefined, validPdf: boolean | undefined, pages: number | undefined;
  if (status === 'success') {
    const response = await fetch(`${base}/api/v1/projects/${user.projectId}/compile/${submitted.data.job.id}/artifact`,
      { headers: { authorization: `Bearer ${user.token}` }, signal: AbortSignal.timeout(15_000) });
    const pdf = Buffer.from(await response.arrayBuffer()); pdfBytes = pdf.length;
    validPdf = response.ok && pdf.subarray(0, 5).toString() === '%PDF-';
    pages = [...pdf.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length;
  }
  compileResults.push({ status, durationMs: performance.now() - began, pdfBytes, validPdf, pages });
}

const report: Record<string, unknown> = { runId, label, startedAt: new Date().toISOString(),
  scope: 'Actual module routes in isolated Fastify child; local TCP HTTP/WebSocket and scratch PostgreSQL. Not full buildApp/proxy/browser/external integrations.',
  profile: { users: userCount, projects: projectCount, usersPerProject: userCount / projectCount, seconds, poolMax, poolTimeoutMs, fileBytes,
    instrumentation: instrumentation === 'true', instrumentationScrape: 'Once at each phase end; no periodic scraper traffic',
    accessPeriodMs: 2000, autosavePeriodMs: 10_000, chatPeriodMs: 10_000, rotatingReadPeriodMs: 5000,
    fileEventFanout: 'listFiles per recipient plus changed content for peers', chatEventFanout: 'one PUT read-state per visible open panel, coalesced100ms',
    compilePeriodMs: 20_000, login: 'all distinct users concurrently, real bcrypt cost10', jwt: 'actual login responses, one per user' },
  host: { platform: platform(), release: release(), cpuModel: cpus()[0]?.model, logicalCores: cpus().length, totalMemoryBytes: totalmem(), node: process.version },
  thresholds: { steadyUnexpectedErrors: 0, unexpectedSocketCloses: 0, missingDeliveries: 0, apiP95Ms: 1000, realtimeFromSendP95Ms: 1500, revokeCloseMs: 5000 } };
const admin = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  await admin.connect(); assert.match(schema, /^codex_load_[a-f0-9]{16}$/);
  await admin.query(`CREATE SCHEMA "${schema}"`); await admin.query(`SET search_path TO "${schema}"`);
  await admin.query((await readFile(new URL('./fixtures/project-sharing-baseline.sql', import.meta.url), 'utf8')).replace('CREATE SCHEMA IF NOT EXISTS "public";', ''));
  await admin.query(await readFile(new URL('../prisma/migrations/20261003000000_project_sharing_and_chat/migration.sql', import.meta.url), 'utf8'));
  report.postgres = (await admin.query('SELECT version() AS version')).rows[0].version;
  storageDir = await mkdtemp(join(tmpdir(), 'codex-load-'));
  const hashFiles = ['modules/projects/infra/CollaborationTransaction.ts', 'modules/projects/infra/sharing/PrismaSharingRepository.ts',
    'modules/project-discussion/infra/PrismaRealtimeSessionPolicy.ts', 'modules/project-discussion/delivery/ws/ProjectRealtime.ts',
    'modules/project-discussion/application/ProjectDiscussionUseCases.ts', 'modules/project-discussion/domain/Ports.ts',
    'modules/project-discussion/domain/RealtimePorts.ts',
    'modules/project-discussion/infra/PrismaDiscussionRepository.ts', 'modules/compile/infra/NodeTypstCompileService.ts', 'modules/compile/infra/InProcessCompileQueue.ts',
    'modules/auth/infra/PasswordHasherBcrypt.ts', 'modules/auth/application/PasswordWorkAdmission.ts',
    'modules/auth/domain/PasswordWorkUnavailable.ts', 'modules/auth/delivery/http/PasswordWorkHttp.ts',
    'modules/auth/delivery/http/Routes.ts', 'config/TrustedProxies.ts', 'modules/compile/Container.ts', 'modules/compile/infra/ChildProcessTypstCompiler.ts',
    'modules/compile/infra/TypstCompileChild.ts', 'config/index.ts', 'plugins/Prisma.ts',
    'modules/compile/infra/BoundedCompileQueue.ts', 'modules/compile/application/EnqueueOrReuseCompileJob.ts',
    'modules/compile/application/GetLatestProjectArtifactForAdmin.ts', 'modules/project-discussion/infra/BatchedRealtimeSessionPolicy.ts',
    'plugins/JWT.ts', 'modules/auth/application/ReadTokenSessionUseCase.ts', 'modules/auth/infra/PrismaTokenSessionReader.ts',
    'shared/auth/LruTokenRevocationCache.ts', 'plugins/Lifecycle.ts', 'plugins/Metrics.ts',
    'shared/observability/ServiceMetrics.ts', 'shared/observability/ObservedPgPool.ts', 'plugins/SharedState.ts',
    'shared/rate-limit/RateLimitStore.ts', 'shared/rate-limit/RequestRateLimit.ts', 'shared/rate-limit/LocalRateLimitStore.ts',
    'shared/rate-limit/RedisRateLimitStore.ts', 'shared/redis/BoundedRedisConnection.ts',
    'modules/project-discussion/application/RealtimeTickets.ts', 'modules/project-discussion/domain/RealtimeTicketStore.ts',
    'modules/project-discussion/infra/LocalRealtimeTicketStore.ts', 'modules/project-discussion/infra/RedisRealtimeTicketStore.ts',
    'modules/project-discussion/application/RealtimeSocketLeases.ts', 'modules/project-discussion/domain/RealtimeSocketLeaseStore.ts',
    'modules/project-discussion/infra/LocalRealtimeSocketLeaseStore.ts', 'modules/project-discussion/infra/RedisRealtimeSocketLeaseStore.ts',
    'modules/project-discussion/delivery/http/Routes.ts', 'modules/projects/delivery/http/ProjectSharing/Routes.ts', 'shared/http/domainError.ts'];
  report.sourceHashes = Object.fromEntries(await Promise.all(hashFiles.map(async path => [path,
    createHash('sha256').update(await readFile(new URL(`../src/${path}`, import.meta.url))).digest('hex')])));
  const lockBytes = await readFile(new URL('../package-lock.json', import.meta.url));
  const lock = JSON.parse(lockBytes.toString());
  report.dependencyLockSha256 = createHash('sha256').update(lockBytes).digest('hex');
  report.dependencyVersions = Object.fromEntries(['fastify', '@fastify/jwt', 'fast-jwt', 'ws', 'pg',
    '@prisma/client', '@prisma/adapter-pg', 'bcrypt', '@myriaddreamin/typst-ts-node-compiler', '@prometheus-io/client']
    .map(name => [name, lock.packages[`node_modules/${name}`]?.version ?? 'unknown']));
  child = fork(fileURLToPath(new URL('./load-system-capacity-worker.ts', import.meta.url)), [], { execArgv: ['--import', 'tsx'],
    cwd: fileURLToPath(new URL('..', import.meta.url)), stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    env: { ...process.env, LOG_LEVEL: 'silent', JWT_SECRET: randomBytes(32).toString('hex'), PROJECT_SHARING_ENABLED: 'true',
      ENABLE_SWAGGER: 'false', STORAGE_DIR: storageDir, TEMP: storageDir, TMP: storageDir } });
  let stderrBytes = 0; child.stderr?.on('data', data => { stderrBytes += data.length; });
  child.on('message', (message: any) => { const reply = replies.get(message.id); if (!reply) return;
    clearTimeout(reply.timer); replies.delete(message.id); if (message.error) reply.reject(new Error(message.error)); else reply.resolve(message.result); });
  child.on('exit', () => { for (const reply of replies.values()) { clearTimeout(reply.timer); reply.reject(new Error('Worker exited')); } replies.clear(); });
  const fixture = await rpc('init', { schema, users: userCount, projects: projectCount, fileBytes, storageDir, poolMax, poolTimeoutMs,
    instrumentation: instrumentation === 'true' });
  base = `http://127.0.0.1:${fixture.port}`;
  report.fixture = { fileBytes: fixture.contentBytes, files: fixture.contentBytes.length, sourceBytes: fixture.contentBytes.reduce((a: number, b: number) => a + b, 0) };
  users = fixture.users.map((u: FixtureUser) => ({ ...u, token: '', cursor: '0', seen: new Set(), expectedClose: false, paused: false,
    latestChatSeq: '0', changedFiles: new Map(), next: {}, busy: new Set(), readTurn: 0, saveTurn: 0 }));
  console.log(`Capacity ${label}: ${userCount} users / ${projectCount} projects; isolated server ready.`);
  phase = 'login'; await rpc('start'); startHealth(); const loginStart = performance.now();
  await Promise.all(users.map(async user => {
    const response = await request(undefined, 'auth.login', 'POST', '/auth/login', { email: user.email, password: fixture.password });
    assert(response.ok && response.data?.accessToken, `Login failed for user ${user.index}`); user.token = response.data.accessToken;
  }));
  report.login = { durationMs: performance.now() - loginStart, server: await rpc('stats') };
  phase = 'bootstrap'; await rpc('start'); const joinStart = performance.now();
  await Promise.all(users.map(async user => {
    await Promise.all([
      request(user, 'auth.me', 'GET', '/auth/me'), request(user, 'metadata', 'GET', `/projects/${user.projectId}`),
      request(user, 'files', 'GET', `/projects/${user.projectId}/files`), request(user, 'settings', 'GET', `/projects/${user.projectId}/settings`),
      request(user, 'metadata.refresh', 'GET', `/projects/${user.projectId}`), request(user, 'files.refresh', 'GET', `/projects/${user.projectId}/files`),
      request(user, 'settings.refresh', 'GET', `/projects/${user.projectId}/settings`), request(user, 'access', 'GET', `/projects/${user.projectId}/access`),
      request(user, 'events', 'GET', `/projects/${user.projectId}/events?since=0`), request(user, 'read-state', 'GET', `/projects/${user.projectId}/chat/read-state`),
      request(user, 'chat.history', 'GET', `/projects/${user.projectId}/chat/messages`), request(user, 'comments.threads', 'GET', `/projects/${user.projectId}/comments/threads`),
      ...users.filter(peer => peer.projectId === user.projectId).map(peer => request(user, 'content', 'GET', `/projects/${user.projectId}/files/${encodeURIComponent(peer.path)}`)),
      connect(user),
    ]);
  }));
  report.bootstrap = { durationMs: performance.now() - joinStart, maxConnectedSockets: maxSockets, server: await rpc('stats') };
  assert.equal(maxSockets, userCount);
  phase = 'steady'; await rpc('start'); running = true;
  const steadyStart = performance.now(), end = steadyStart + seconds * 1000;
  for (const user of users) user.next = { access: steadyStart + user.index / userCount * 2000,
    save: steadyStart + user.index / userCount * 10_000, chat: steadyStart + (user.index / userCount * 10_000 + 5000) % 10_000,
    read: steadyStart + user.index / userCount * 5000 };
  let nextCompile = steadyStart + Math.min(10_000, seconds * 300), compileIndex = 0;
  let safetyStarted = false, safetyTask: Promise<void> | undefined;
  const safety = async () => {
    const victim = users.at(-1)!, owner = users[victim.ownerIndex]; victim.paused = true;
    while (victim.busy.size) await pause(20);
    const began = performance.now(), closed = new Promise<number>(resolveClose => victim.ws!.once('close', code => resolveClose(code)));
    victim.expectedClose = true;
    const blocked = await request(owner, 'safety.revoke', 'DELETE', `/projects/${victim.projectId}/members/${victim.memberId}`);
    assert(blocked.ok);
    // Revocation can race with a write started earlier; delivery to the removed user is no longer required after denial.
    for (const mutation of mutations.values()) if (!mutation.received.has(victim.index) && (!mutation.ack || mutation.ack > began)) mutation.expected.delete(victim.index);
    const code = await Promise.race([closed, pause(5000).then(() => 0)]), closeMs = performance.now() - began;
    const readDenied = await request(victim, 'safety.denied.access', 'GET', `/projects/${victim.projectId}/access`, undefined, [403]);
    const writeDenied = await request(victim, 'safety.denied.save', 'PUT', `/projects/${victim.projectId}/files/${encodeURIComponent(victim.path)}`,
      { content: source(victim), fileId: victim.fileId, baseRevision: victim.revision }, [403]);
    const chatDenied = await request(victim, 'safety.denied.chat', 'POST', `/projects/${victim.projectId}/chat/messages`,
      { clientMessageId: randomUUID(), body: 'Must be denied' }, [403]);
    const seenBeforeDeniedChat = victim.seen.size;
    await sendChat(owner); await pause(150);
    forbiddenDeliveries += victim.seen.size - seenBeforeDeniedChat;
    report.safety = { closeCode: code, closeMs, readDenied: readDenied.status, writeDenied: writeDenied.status,
      chatDenied: chatDenied.status, forbiddenDeliveries };
    const restored = await request(owner, 'safety.restore', 'PATCH', `/projects/${victim.projectId}/members/${victim.memberId}`, { status: 'active', roleOverride: 'editor' });
    assert(restored.ok); victim.expectedClose = false; victim.paused = false; await connect(victim);
    assert.equal(code, 4403); assert(closeMs <= 5000); assert(readDenied.ok && writeDenied.ok && chatDenied.ok);
  };
  while (performance.now() < end) {
    const now = performance.now();
    for (const user of users) for (const [kind, period, work] of [
      ['access', 2000, () => request(user, 'access', 'GET', `/projects/${user.projectId}/access`)],
      ['save', 10_000, () => save(user)], ['chat', 10_000, () => sendChat(user)], ['read', 5000, () => read(user)],
    ] as const) {
      if (now < user.next[kind]) continue;
      scheduleLag.push(now - user.next[kind]); user.next[kind] += period;
      if (user.paused || user.busy.has(kind)) { const reason = `${kind}.${user.paused ? 'permission-test-pause' : 'inflight'}`; skipped[reason] = (skipped[reason] ?? 0) + 1; continue; }
      user.busy.add(kind); track(work().finally(() => user.busy.delete(kind)));
    }
    if (now >= nextCompile) { nextCompile += 20_000; track(compile(users[(compileIndex++ % projectCount) * (userCount / projectCount)])); }
    if (!safetyStarted && now > steadyStart + seconds * 600) { safetyStarted = true; safetyTask = safety(); track(safetyTask); }
    await pause(10);
  }
  if (safetyTask) await safetyTask;
  // Stop periodic writes, then retain subscriptions and fanout until in-flight delivery settles.
  const drainStart = performance.now();
  while ((pending.size || users.some(user => user.chatTimer || user.fileTimer)) && performance.now() - drainStart < 70_000) await pause(50);
  await pause(300); running = false;
  report.steady = { offeredDurationMs: seconds * 1000, elapsedIncludingDrainMs: performance.now() - steadyStart,
    drainMs: performance.now() - drainStart, server: await rpc('stats'), remainingTasks: pending.size,
    connectedAtEnd: users.filter(user => user.ws?.readyState === WebSocket.OPEN).length };
  const fromSend: number[] = [], minusAck: number[] = []; let expectedDeliveries = 0, receivedDeliveries = 0;
  for (const mutation of mutations.values()) if (mutation.success) {
    expectedDeliveries += mutation.expected.size;
    for (const received of mutation.received.values()) { receivedDeliveries++; fromSend.push(received - mutation.started); if (mutation.ack) minusAck.push(received - mutation.ack); }
  }
  report.realtime = { fromHttpStartMs: summary(fromSend), deliveryMinusHttpResponseAckMs: summary(minusAck),
    note: 'Negative ACK deltas mean WebSocket arrived before HTTP response. Neither metric is a server COMMIT timestamp.',
    expectedDeliveries, receivedDeliveries, missingDeliveries: expectedDeliveries - receivedDeliveries,
    unexpectedCloses, duplicateEvents, forbiddenDeliveries, maxConnectedSockets: maxSockets };
  report.compile = compileResults; report.workerStderrBytes = stderrBytes;
  report.completed = true;
} catch (error) {
  report.completed = false;
  report.failure = error instanceof Error ? `${error.name}: ${error.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[database]')}` : 'Unknown failure';
  if (child && child.exitCode === null) {
    try { report.failureServer = await rpc('stats'); } catch { /* Preserve the original failure. */ }
  }
  process.exitCode = 1;
} finally {
  stopping = true; running = false; clearInterval(healthTimer);
  for (const user of users) { clearTimeout(user.chatTimer); clearTimeout(user.fileTimer); user.ws?.terminate(); }
  if (child && child.exitCode === null) { try { await rpc('close'); } catch { child.kill(); } }
  try {
    assert.match(schema, /^codex_load_[a-f0-9]{16}$/);
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); report.scratchSchemaRemoved = true;
  } catch { report.scratchSchemaRemoved = false; process.exitCode = 1; }
  await admin.end().catch(() => {});
  if (storageDir) {
    assert.equal(dirname(resolve(storageDir)), resolve(tmpdir())); assert.match(basename(storageDir), /^codex-load-[A-Za-z0-9]+$/);
    await rm(storageDir, { recursive: true, force: true });
  }
  report.endpoints = endpoints(); report.offered = offered; report.skipped = skipped; report.driverErrors = driverErrors;
  report.schedulingLagMs = summary(scheduleLag); report.finishedAt = new Date().toISOString();
  report.health = { latencyMsByPhase: Object.fromEntries([...healthSamples].map(([name, values]) => [name, summary(values)])), failures: healthFailures, skippedDueToInflight: healthSkipped };
  const errors = [...metrics.values()].reduce((total, value) => total + Object.values(value.errorCodes).reduce((a, b) => a + b, 0), 0);
  const realtime = report.realtime as { missingDeliveries: number; fromHttpStartMs: { p95: number } } | undefined;
  const steady = report.steady as { remainingTasks: number; connectedAtEnd: number } | undefined;
  const checks = {
    completed: report.completed === true,
    noUnexpectedHttpErrorsIncludingBootstrap: errors === 0,
    allSocketsConnected: maxSockets === userCount && steady?.connectedAtEnd === userCount,
    noUnexpectedDisconnectsOrMissingEvents: unexpectedCloses === 0 && realtime?.missingDeliveries === 0 && forbiddenDeliveries === 0,
    steadyApiP95Under1000ms: [...metrics].filter(([name]) => name.startsWith('steady/')).every(([, value]) => summary(value.durationMs).p95 < 1000),
    realtimeP95Under1500ms: !!realtime && realtime.fromHttpStartMs.p95 < 1500,
    allCompileJobsProducedPdf: compileResults.length > 0 && compileResults.every(result => result.status === 'success' && result.validPdf),
    noLoadDroppedOrDriverFailure: Object.entries(skipped).every(([reason]) => reason.endsWith('permission-test-pause')) && Object.keys(driverErrors).length === 0 && steady?.remainingTasks === 0,
    healthAvailable: healthFailures === 0,
    scratchSchemaRemoved: report.scratchSchemaRemoved === true,
  };
  report.acceptance = { passed: Object.values(checks).every(Boolean), checks, unexpectedHttpErrors: errors };
  if (!Object.values(checks).every(Boolean)) process.exitCode = 1;
  await mkdir(reportDir, { recursive: true }); await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Capacity report: ${outputPath}`);
  console.log(JSON.stringify({ completed: report.completed, failure: report.failure, realtime: report.realtime,
    compile: report.compile, skipped, driverErrors, scratchSchemaRemoved: report.scratchSchemaRemoved }));
}
