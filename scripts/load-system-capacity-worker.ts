// Child process for the isolated capacity harness; never starts against the application schema.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { getHeapStatistics } from 'node:v8';
import pg from 'pg';
import Fastify from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { jwtPlugin } from '../src/plugins/JWT.js';
import type { AppConfig } from '../src/config/index.js';
import { authRoutes } from '../src/modules/auth/delivery/http/Routes.js';
import { PasswordHasherBcrypt } from '../src/modules/auth/infra/PasswordHasherBcrypt.js';
import { ProjectsContainer } from '../src/modules/projects/Container.js';
import { ProjectFilesContainer } from '../src/modules/project-files/Container.js';
import { FileRepoPrisma } from '../src/modules/project-files/infra/FileRepoPrisma.js';
import { ProjectRepoPrisma } from '../src/modules/projects/infra/ProjectRepoPrisma.js';
import { ProjectSharingUseCases } from '../src/modules/projects/application/sharing/ProjectSharingUseCases.js';
import { PrismaSharingRepository } from '../src/modules/projects/infra/sharing/PrismaSharingRepository.js';
import { ShareTokenCrypto } from '../src/modules/projects/infra/sharing/ShareTokenCrypto.js';
import { projectSharingRoutes } from '../src/modules/projects/delivery/http/ProjectSharing/Routes.js';
import { projectRoutes } from '../src/modules/projects/delivery/http/Project/Routes.js';
import { projectSettingsRoutes } from '../src/modules/projects/delivery/http/ProjectSettings/Routes.js';
import { projectFileRoutes } from '../src/modules/project-files/delivery/http/ProjectFile/Routes.js';
import { ProjectDiscussionUseCases } from '../src/modules/project-discussion/application/ProjectDiscussionUseCases.js';
import { PrismaDiscussionRepository } from '../src/modules/project-discussion/infra/PrismaDiscussionRepository.js';
import { projectDiscussionRoutes } from '../src/modules/project-discussion/delivery/http/Routes.js';
import { RealtimeTickets } from '../src/modules/project-discussion/application/RealtimeTickets.js';
import { LocalRealtimeTicketStore } from '../src/modules/project-discussion/infra/LocalRealtimeTicketStore.js';
import { RealtimeSocketLeases } from '../src/modules/project-discussion/application/RealtimeSocketLeases.js';
import { LocalRealtimeSocketLeaseStore } from '../src/modules/project-discussion/infra/LocalRealtimeSocketLeaseStore.js';
import { sharedStatePlugin } from '../src/plugins/SharedState.js';
import { PrismaRealtimeSessionPolicy } from '../src/modules/project-discussion/infra/PrismaRealtimeSessionPolicy.js';
import { PostgresProjectEventWakeSource } from '../src/modules/project-discussion/infra/PostgresProjectEventWakeSource.js';
import { registerProjectRealtime } from '../src/modules/project-discussion/delivery/ws/ProjectRealtime.js';
import { compileRoutes } from '../src/modules/compile/delivery/http/Routes.js';
import { buildCompileContainer } from '../src/modules/compile/Container.js';
import { createBlobStorage } from '../src/shared/storage/BlobStorageFactory.js';
import { toErrorResponse } from '../src/shared/http/domainError.js';
import { healthRoutes } from '../src/api/health.js';
import { metricsPlugin } from '../src/plugins/Metrics.js';
import { observePgPool } from '../src/shared/observability/ObservedPgPool.js';

export type FixtureUser = { index: number; id: string; email: string; projectId: string; memberId: string | null;
  ownerIndex: number; fileId: string; path: string; revision: number };
type Init = { schema: string; users: number; projects: number; fileBytes: number; storageDir: string; poolMax: number; poolTimeoutMs: number; instrumentation: boolean };

const app = Fastify({ logger: false, keepAliveTimeout: 72_000, bodyLimit: 1_048_576, ajv: { customOptions: { strict: false } } });
let pool: pg.Pool | undefined, prisma: PrismaClient | undefined;
const loop = monitorEventLoopDelay({ resolution: 10 });
let measuring = false, start = 0, sqlCount = 0, sqlMs = 0;
let cpuStart = process.cpuUsage();
let waits: number[] = [], samples: unknown[] = [], queriesByTable: Record<string, number> = {};
let lastSql = 0, lastSample = performance.now(), lastCpu = process.cpuUsage();

function percentiles(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p: number) => sorted.length ? Number(sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)].toFixed(3)) : 0;
  return { count: sorted.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: q(1) };
}
// Process-level numbers only. External includes arrayBuffers; V8 malloced memory
// is not all native memory, and RSS minus heap does not identify a leak.
function memorySnapshot() {
  const memory = process.memoryUsage(), heap = getHeapStatistics();
  return { rssBytes: memory.rss, heapUsedBytes: memory.heapUsed, heapTotalBytes: memory.heapTotal,
    externalBytes: memory.external, arrayBuffersBytes: memory.arrayBuffers,
    v8PhysicalBytes: heap.total_physical_size, v8MallocedBytes: heap.malloced_memory,
    v8PeakMallocedBytes: heap.peak_malloced_memory, heapLimitBytes: heap.heap_size_limit };
}
const sampler = setInterval(() => {
  if (!measuring || !pool) return;
  const now = performance.now(), cpu = process.cpuUsage(), elapsed = now - lastSample;
  samples.push({ elapsedMs: Math.round(now - start), sqlPerSecond: (sqlCount - lastSql) / elapsed * 1000,
    ...memorySnapshot(),
    poolTotal: pool.totalCount, poolIdle: pool.idleCount, poolWaiting: pool.waitingCount,
    cpuCorePercent: (cpu.user + cpu.system - lastCpu.user - lastCpu.system) / elapsed / 10 });
  lastSample = now; lastSql = sqlCount; lastCpu = cpu;
}, 1000);
sampler.unref();

async function initialize(input: Init) {
  assert.match(input.schema, /^codex_load_[a-f0-9]{16}$/);
  assert.equal(input.users % input.projects, 0);
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${input.schema}`,
    max: input.poolMax, connectionTimeoutMillis: input.poolTimeoutMs, application_name: `${input.schema}_app` });
  const originalConnect = pool.connect.bind(pool);
  // Measure actual acquisition delay including time queued behind occupied connections.
  pool.connect = ((callback?: (error: Error | undefined, client: pg.PoolClient, release: (error?: Error | boolean) => void) => void) => {
    const began = performance.now();
    if (callback) return originalConnect((error, client, release) => {
      if (measuring) waits.push(performance.now() - began);
      callback(error, client!, release!);
    });
    return originalConnect().then(client => { if (measuring) waits.push(performance.now() - began); return client; });
  }) as typeof pool.connect;
  const db = new PrismaClient({ adapter: new PrismaPg(pool, { schema: input.schema }), log: [{ emit: 'event', level: 'query' }] });
  prisma = db;
  db.$on('query', event => {
    app.serviceMetrics?.observeQuery(event.query, event.duration);
    if (!measuring) return;
    sqlCount++; sqlMs += event.duration;
    const table = /(?:FROM|INTO|UPDATE)\s+(?:"[^"]+"\.)?"([^"]+)"/.exec(event.query)?.[1] ?? 'transaction/control';
    queriesByTable[table] = (queriesByTable[table] ?? 0) + 1;
  });
  const password = randomBytes(24).toString('base64url'), passwordHash = await new PasswordHasherBcrypt().hash(password);
  const users: FixtureUser[] = [];
  const groupSize = input.users / input.projects;
  const projectIds = Array.from({ length: input.projects }, () => randomUUID());
  for (let i = 0; i < input.users; i++) users.push({ index: i, id: randomUUID(), email: `capacity-${i}@e.tlu.edu.vn`,
    projectId: projectIds[Math.floor(i / groupSize)], ownerIndex: Math.floor(i / groupSize) * groupSize,
    memberId: i % groupSize ? randomUUID() : null, fileId: randomUUID(), path: i % groupSize ? `user-${i}.typ` : 'main.typ', revision: 1 });
  await db.user.createMany({ data: users.map(user => ({ id: user.id, email: user.email, role: 'student', passwordHash })) });
  await db.project.createMany({ data: projectIds.map((id, i) => ({ id, title: `Capacity project ${i}`, category: 'other', ownerId: users[i * groupSize].id })) });
  await db.projectCollaborationState.createMany({ data: projectIds.map(projectId => ({ projectId })) });
  await db.projectSettings.createMany({ data: projectIds.map(projectId => ({ projectId, mainPath: 'main.typ' })) });
  await db.projectMember.createMany({ data: users.filter(user => user.memberId).map(user => ({ id: user.memberId!, projectId: user.projectId,
    userId: user.id, roleOverride: 'editor', status: 'active' })) });
  const paragraph = 'This reproducible academic document measures collaborative storage and native PDF export under concurrent editing.\n\n';
  const contents = users.map(user => `= Chapter ${user.index}\n` + paragraph.repeat(Math.ceil(input.fileBytes / paragraph.length)) +
    (user.index === user.ownerIndex ? users.filter(peer => peer.projectId === user.projectId && peer.index !== user.index)
      .map(peer => `\n#pagebreak()\n#include "${peer.path}"\n`).join('') : ''));
  await db.file.createMany({ data: users.map((user, index) => ({ id: user.fileId, projectId: user.projectId, path: user.path, kind: 'typst',
    textContent: contents[index], sizeBytes: Buffer.byteLength(contents[index]), sha256: createHash('sha256').update(contents[index]).digest('hex') })) });
  const config = { auth: { jwtSecret: randomBytes(32).toString('hex'), accessTtl: '1h', refreshTtl: '1d',
    passwordWork: { concurrency: 4, maxOutstanding: 128, queueWaitMs: 5000 },
    loginIpPerMinute: 12000, loginPairPerMinute: 10, changePasswordPerMinute: 5 },
    sharedState: { driver: 'local' },
    observability: { metricsEnabled: input.instrumentation, metricsToken: randomBytes(32).toString('hex') },
    collaboration: { enabled: true, origins: ['http://capacity.test'] }, upload: { maxBytes: 50 * 1024 * 1024 },
    compile: { workerEnabled: true, timeoutMs: 60_000, maxSnapshotBytes: 256 * 1024 * 1024, fontDirs: './var/fonts',
      maxOutstandingJobs: 32 }, storage: { driver: 'local', dir: input.storageDir } } as unknown as AppConfig;
  app.decorate('prisma', db); app.decorate('config', config); app.decorate('storage', createBlobStorage('local', input.storageDir));
  await app.register(metricsPlugin);
  await app.register(sharedStatePlugin);
  if (app.serviceMetrics) observePgPool(pool, app.serviceMetrics);
  app.setErrorHandler((error, _request, reply) => { const mapped = toErrorResponse(error);
    if (mapped.retryAfterSeconds) reply.header('Retry-After', mapped.retryAfterSeconds);
    return reply.code(mapped.status).send(mapped.body); });
  await app.register(jwtPlugin);
  await app.register(healthRoutes);
  const files = new FileRepoPrisma(db), projects = new ProjectsContainer(db, files), projectRepo = new ProjectRepoPrisma(db);
  const discussion = new ProjectDiscussionUseCases(new PrismaDiscussionRepository(db));
  const tickets = new RealtimeTickets(new ShareTokenCrypto(), new PrismaRealtimeSessionPolicy(db,
    { connectionTimeoutMs: input.poolTimeoutMs }), new LocalRealtimeTicketStore());
  const compiler = buildCompileContainer(app);
  await app.register(async child => {
    await child.register(authRoutes, { prefix: '/auth' });
    await projectSharingRoutes(child, new ProjectSharingUseCases(new PrismaSharingRepository(db), new ShareTokenCrypto()));
    await projectDiscussionRoutes(child, discussion);
    await projectRoutes(child, projects);
    await projectSettingsRoutes(child, projects);
    await projectFileRoutes(child, new ProjectFilesContainer(db, projectRepo));
    await compileRoutes(child, compiler);
    child.post<{ Params: { projectId: string } }>('/projects/:projectId/realtime-ticket', { preHandler: child.auth.verify }, async request => {
      await app.requestRateLimit!.check(`realtime-ticket:${request.user.sub}`, 60);
      return tickets.create({ projectId: request.params.projectId, actor: { userId: request.user.sub, role: request.user.role },
        jti: request.user.jti, expiresAt: Number(request.user.exp) * 1000 });
    });
  }, { prefix: '/api/v1' });
  registerProjectRealtime(app, tickets, discussion, ['http://capacity.test'],
    new RealtimeSocketLeases(new LocalRealtimeSocketLeaseStore(), () => randomBytes(16).toString('hex')), new PostgresProjectEventWakeSource({
    connectionString: process.env.DATABASE_URL, options: `-c search_path=${input.schema}`, application_name: `${input.schema}_wake` }));
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address(); assert(address && typeof address !== 'string');
  return { port: address.port, users, password, contentBytes: contents.map(content => Buffer.byteLength(content)) };
}

process.on('message', async (message: { id: number; command: string; input?: Init }) => {
  try {
    let result: unknown;
    if (message.command === 'init') result = await initialize(message.input!);
    else if (message.command === 'start') {
      sqlCount = 0; sqlMs = 0; waits = []; samples = []; queriesByTable = {}; lastSql = 0;
      start = lastSample = performance.now(); cpuStart = lastCpu = process.cpuUsage(); loop.reset(); loop.enable(); measuring = true;
    } else if (message.command === 'stats') {
      const elapsedMs = performance.now() - start, cpu = process.cpuUsage(cpuStart);
      result = { elapsedMs, sqlCount, sqlPerSecond: sqlCount / elapsedMs * 1000, sqlDurationSumMs: sqlMs, queriesByTable,
        authSessions: app.authSessionMetrics(),
        instrumentationSnapshot: app.serviceMetrics ? await app.serviceMetrics.registry.metrics() : undefined,
        poolAcquisitionMs: percentiles(waits), eventLoopDelayMs: { p50: loop.percentile(50) / 1e6, p95: loop.percentile(95) / 1e6,
          p99: loop.percentile(99) / 1e6, max: loop.max / 1e6 }, cpuSeconds: (cpu.user + cpu.system) / 1e6,
        cpuCorePercent: (cpu.user + cpu.system) / elapsedMs / 10, ...memorySnapshot(), samples };
      measuring = false; loop.disable();
    } else if (message.command === 'close') {
      clearInterval(sampler); loop.disable(); await app.close(); await prisma?.$disconnect(); await pool?.end();
    } else throw new Error('Unknown harness command');
    process.send?.({ id: message.id, result });
    if (message.command === 'close') process.disconnect?.();
  } catch (error) {
    // No raw SQL parameters, credentials, or connection strings cross into the report/log.
    process.send?.({ id: message.id, error: error instanceof Error ? `${error.name}: ${error.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[database]')}` : 'Harness worker error' });
  }
});
