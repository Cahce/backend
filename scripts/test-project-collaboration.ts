import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import Fastify from 'fastify';
import { Ajv, type ValidateFunction } from 'ajv';
import type { OpenAPIV3 } from 'openapi-types';
import { swaggerPlugin } from '../src/swagger/index.js';
import { discussionDocumentation } from '../src/modules/project-discussion/delivery/http/OpenApi.js';
import { WebSocket } from 'ws';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { jwtPlugin } from '../src/plugins/JWT.js';
import { PrismaTokenSessionReader } from '../src/modules/auth/infra/PrismaTokenSessionReader.js';
import type { AppConfig } from '../src/config/index.js';
import { ProjectsContainer } from '../src/modules/projects/Container.js';
import { ProjectFilesContainer } from '../src/modules/project-files/Container.js';
import { FileRepoPrisma } from '../src/modules/project-files/infra/FileRepoPrisma.js';
import { ProjectRepoPrisma } from '../src/modules/projects/infra/ProjectRepoPrisma.js';
import { TemplateCategory } from '../src/modules/projects/domain/Project/Types.js';
import { FileKind } from '../src/modules/project-files/domain/ProjectFile/Types.js';
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
import { PrismaRealtimeSessionPolicy } from '../src/modules/project-discussion/infra/PrismaRealtimeSessionPolicy.js';
import { PostgresProjectEventWakeSource } from '../src/modules/project-discussion/infra/PostgresProjectEventWakeSource.js';
import { registerProjectRealtime } from '../src/modules/project-discussion/delivery/ws/ProjectRealtime.js';
import { toErrorResponse } from '../src/shared/http/domainError.js';
import { BibliographyService } from '../src/modules/bibliography/application/BibliographyService.js';
import { PrismaCompileAccessRepository } from '../src/modules/compile/infra/PrismaCompileAccessRepository.js';
import { PrismaProjectAccessRepository } from '../src/modules/projects/infra/PrismaProjectAccessRepository.js';
import { UploadBinaryFileUseCase } from '../src/modules/project-files/application/UploadBinaryFileUseCase.js';
import type { BlobStorage } from '../src/shared/storage/BlobStorage.js';
import type { CommentView, MessageView, ThreadView } from '../src/modules/project-discussion/domain/Ports.js';
import type { ProjectActor } from '../src/modules/projects/domain/sharing/Ports.js';
import type { ProjectEventWakeSource } from '../src/modules/project-discussion/domain/RealtimePorts.js';
import { ServiceMetrics } from '../src/shared/observability/ServiceMetrics.js';

type ReplayPage = Awaited<ReturnType<ProjectDiscussionUseCases['events']>>;
type ReplayFrame = Partial<ReplayPage> & { type: string };
async function connectRealtime(url: string, ticket: string, since: string, sockets: Set<WebSocket>) {
  const socket = new WebSocket(url, { origin: 'http://collaboration.test' });
  sockets.add(socket);
  const frames: ReplayFrame[] = [];
  let closeCode: number | undefined;
  socket.on('message', data => frames.push(JSON.parse(data.toString())));
  socket.on('close', code => { closeCode = code; });
  await new Promise<void>((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  socket.send(JSON.stringify({ type: 'authenticate', ticket, since }));
  await waitUntil(() => frames.some(frame => frame.type === 'ready'));
  return { socket, frames, closeCode: () => closeCode,
    sequences: () => frames.flatMap(frame => frame.events?.map(event => event.seq) ?? []) };
}

class ControlledProjectWakeSource implements ProjectEventWakeSource {
  private listener?: (projectId: string) => void;
  async start() {}
  async stop() { this.listener = undefined; }
  subscribe(listener: (projectId: string) => void) { this.listener = listener; return () => { this.listener = undefined; }; }
  wake(projectId: string) { this.listener?.(projectId); }
}

async function waitUntil(condition: () => boolean, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (!condition() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert(condition(), `Condition was not met within ${timeout}ms`);
}

async function waitForDatabase<T>(read: () => Promise<T>, condition: (value: T) => boolean, timeout = 5000): Promise<T> {
  const deadline = performance.now() + timeout;
  let value = await read();
  while (!condition(value) && performance.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 20));
    value = await read();
  }
  assert(condition(value), `Database condition was not met within ${timeout}ms`);
  return value;
}

function policyTimeoutFixture(schema: string, observer: pg.Client) {
  assert.match(schema, /^codex_collab_[a-f0-9]{16}$/);
  const applicationName = `${schema}_policy_timeout_${randomBytes(4).toString('hex')}`;
  // A distinct session default proves that SET LOCAL never leaks back into the pool.
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000,
    options: `-c search_path=${schema} -c statement_timeout=7000`, application_name: applicationName });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema }) });
  const policy = new PrismaRealtimeSessionPolicy(prisma, { connectionTimeoutMs: 5000 });
  const locker = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000,
    options: `-c search_path=${schema}`, application_name: `${schema}_policy_lock` });
  const table = `"${schema}"."User"`;
  let lockerPid: number | undefined, connected = false;
  return { policy,
    settings: () => prisma.$queryRaw<Array<{ timeout: string; pid: number }>>`
      SELECT current_setting('statement_timeout') AS timeout, pg_backend_pid() AS pid`,
    async lock() {
      await locker.connect();
      connected = true;
      await locker.query('BEGIN');
      await locker.query("SET LOCAL lock_timeout = '3s'");
      await locker.query("SET LOCAL idle_in_transaction_session_timeout = '30s'");
      lockerPid = (await locker.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      // Only this generated, fully qualified table is ever locked.
      await locker.query(`LOCK TABLE ${table} IN ACCESS EXCLUSIVE MODE`);
    },
    async unlock() { if (connected) await locker.query('ROLLBACK'); },
    async isHeld() {
      const result = await observer.query<{ held: boolean }>(`
        SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid = $1 AND relation = to_regclass($2)
          AND mode = 'AccessExclusiveLock' AND granted) AS held`, [lockerPid, table]);
      return result.rows[0].held;
    },
    async waiting() {
      const result = await observer.query<{ pid: number; queryStartedAt: string }>(`
        SELECT DISTINCT a.pid, a.query_start::text AS "queryStartedAt"
        FROM pg_stat_activity a JOIN pg_locks l ON l.pid = a.pid
        WHERE a.application_name = $1 AND l.relation = to_regclass($2)
          AND l.mode = 'AccessShareLock' AND NOT l.granted
          AND $3 = ANY(pg_blocking_pids(a.pid))`, [applicationName, table, lockerPid]);
      return result.rows;
    },
    async activeWork() {
      return (await observer.query<{ active: number }>(`
        SELECT count(*)::integer AS active FROM pg_stat_activity
        WHERE application_name = $1 AND state IN ('active', 'idle in transaction', 'idle in transaction (aborted)')`,
      [applicationName])).rows[0].active;
    },
    async close(pending: readonly Promise<unknown>[] = []) {
      // Unlock before draining; a failed assertion must not leave a blocked backend behind.
      if (connected) await locker.query('ROLLBACK').catch(() => {});
      await Promise.allSettled(pending);
      try { await prisma.$disconnect(); }
      finally { await Promise.all([pool.end(), locker.end()]); }
    },
  };
}

// OpenAPI 3.0 uses boolean exclusive bounds; Ajv 8 consumes JSON Schema Draft 7.
// Translate the dialect only in this test harness, retaining each numeric constraint.
function schemaForAjv(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(schemaForAjv);
  if (!value || typeof value !== 'object') return value;
  const schema: Record<string, unknown> = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, schemaForAjv(child)]));
  for (const bound of ['Minimum', 'Maximum'] as const) {
    const exclusive = `exclusive${bound}`, inclusive = bound.toLowerCase();
    if (typeof schema[exclusive] !== 'boolean') continue;
    if (schema[exclusive]) {
      assert.equal(typeof schema[inclusive], 'number');
      schema[exclusive] = schema[inclusive];
      delete schema[inclusive];
    } else delete schema[exclusive];
  }
  return schema;
}

test('Project collaboration: additive migration, PostgreSQL, HTTP and native WebSocket', { timeout: 120_000 }, async t => {
  // Only this generated schema is created/dropped. The application's existing schemas remain untouched.
  const schema = `codex_collab_${randomBytes(8).toString('hex')}`;
  assert.match(schema, /^codex_collab_[a-f0-9]{16}$/);
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}`, max: 10 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema }), log: [{ emit: 'event', level: 'query' }] });
  let eventReads = 0, replayHeadReads = 0, queryCount = 0;
  const queryObservers = new Set<(query: string) => void>();
  prisma.$on('query', event => {
    queryCount++;
    // Fresh authorization also uses READ ONLY transactions. Count replay's actual
    // head lookup rather than mistaking an authorization transaction for replay.
    if (/^SELECT\b/.test(event.query) && /\bFROM\s+(?:"[^"]+"\.)?"ProjectCollaborationState"(?:\s|$)/.test(event.query) &&
      !/\bFOR\s+UPDATE\b/.test(event.query)) replayHeadReads++;
    if (/^SELECT\b/.test(event.query) && event.query.includes('"ProjectEvent"')) eventReads++;
    for (const observe of queryObservers) observe(event.query);
  });
  const wakeSource = new PostgresProjectEventWakeSource({ connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${schema}`, application_name: `${schema}_wake` });
  const app = Fastify({ logger: false });
  await admin.connect();
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    const setup = await pool.connect();
    try {
      const baseline = await readFile(new URL('./fixtures/project-sharing-baseline.sql', import.meta.url), 'utf8');
      await setup.query(baseline.replace('CREATE SCHEMA IF NOT EXISTS "public";', ''));
      // A project created before the feature must receive its state and revision defaults.
      await setup.query('INSERT INTO "Project" (id,title,category,"updatedAt") VALUES ($1,$2,$3,NOW())', ['legacy', 'Legacy project', 'other']);
      await setup.query(await readFile(new URL('../prisma/migrations/20261003000000_project_sharing_and_chat/migration.sql', import.meta.url), 'utf8'));
    } finally { setup.release(); }
    await t.test('migration backfills existing orphan project without deleting it', async () => {
      assert.equal((await prisma.project.findUniqueOrThrow({ where: { id: 'legacy' } })).metadataRevision, 1);
      assert.equal((await prisma.projectCollaborationState.findUniqueOrThrow({ where: { projectId: 'legacy' } })).lastEventSeq, 0n);
    });
    const actors: Record<string, { userId: string; role: 'student' | 'admin' }> = {};
    for (const label of ['owner', 'viewer', 'commenter', 'editor', 'outsider', 'admin']) {
      const u = await prisma.user.create({ data: { email: `${label}@example.invalid`, passwordHash: randomBytes(32).toString('hex'), role: label === 'admin' ? 'admin' : 'student' } });
      actors[label] = { userId: u.id, role: u.role as 'student' | 'admin' };
    }
    const owner = actors.owner, viewer = actors.viewer, commenter = actors.commenter, editor = actors.editor;
    const p = await prisma.project.create({ data: { title: 'Collaboration fixture', category: 'other', ownerId: owner.userId } });
    const other = await prisma.project.create({ data: { title: 'Other project', category: 'other', ownerId: owner.userId } });
    const fileRepo = new FileRepoPrisma(prisma), projectRepo = new ProjectRepoPrisma(prisma);
    const sharing = new ProjectSharingUseCases(new PrismaSharingRepository(prisma), new ShareTokenCrypto());
    const discussionRepo = new PrismaDiscussionRepository(prisma), discussion = new ProjectDiscussionUseCases(discussionRepo);
    const tickets = new RealtimeTickets(new ShareTokenCrypto(), new PrismaRealtimeSessionPolicy(prisma), new LocalRealtimeTicketStore());
    const containers = new ProjectsContainer(prisma, fileRepo);
    app.decorate('prisma', prisma);
    app.decorate('config', { auth: { jwtSecret: randomBytes(32).toString('hex') }, collaboration: { enabled: true, origins: ['http://collaboration.test'] }, swagger: { routePrefix: '/docs' } } as AppConfig);
    app.setErrorHandler((error, _req, reply) => { const mapped = toErrorResponse(error); return reply.code(mapped.status).send(mapped.body); });
    await app.register(jwtPlugin);
    await app.register(swaggerPlugin);
    // Validate the actual JSON payload against the generated public schema without changing the response.
    const validator = new Ajv({ strict: false, validateFormats: false });
    const validators = new Map<string, ValidateFunction>(), contractFailures: string[] = [], successfulOperations = new Set<string>();
    let contractResponses = 0;
    app.addHook('onSend', async (request, reply, payload) => {
      if (typeof request.routeOptions.config.swaggerTransform !== 'function') return payload;
      // This oracle covers the 28 collaboration operations; CAS transport has a separate contract suite.
      // The inline realtime ticket has no runtime schema, so its generated operation is checked below.
      const tags = request.routeOptions.schema?.tags;
      if (tags && !tags.some(tag => tag === 'project-sharing' || tag === 'project-discussion')) return payload;
      const path = request.routeOptions.url!.replace(/:([A-Za-z][A-Za-z0-9]*)/g, '{$1}');
      const operation = (app.swagger() as OpenAPIV3.Document).paths[path]?.[request.method.toLowerCase() as OpenAPIV3.HttpMethods];
      const response = operation?.responses[String(reply.statusCode)];
      try {
        assert(operation?.operationId && response && !('$ref' in response), `${request.method} ${path}: missing status ${reply.statusCode}`);
        if (reply.statusCode === 204) assert(payload === null || payload === undefined || payload === '', '204 must be empty');
        else {
          const schema = response.content?.['application/json']?.schema; assert(schema);
          const key = `${operation.operationId}:${reply.statusCode}`;
          let validate = validators.get(key);
          if (!validate) { validate = validator.compile(schemaForAjv(schema) as object); validators.set(key, validate); }
          assert.equal(typeof payload, 'string');
          assert(validate(JSON.parse(payload as string)), `${key}: ${JSON.stringify(validate.errors)}`);
        }
        contractResponses++;
        if (reply.statusCode < 300) successfulOperations.add(operation.operationId);
      } catch (error) { contractFailures.push(`${request.method} ${path} ${reply.statusCode}: ${error instanceof Error ? error.message : String(error)}`); }
      return payload;
    });
    await app.register(async child => {
      await projectSharingRoutes(child, sharing);
      await projectDiscussionRoutes(child, discussion);
      await projectRoutes(child, containers);
      await projectSettingsRoutes(child, containers);
      await projectFileRoutes(child, new ProjectFilesContainer(prisma, projectRepo));
      child.post<{ Params: { projectId: string } }>('/projects/:projectId/realtime-ticket', { preHandler: child.auth.verify, ...discussionDocumentation.ticket }, req =>
        tickets.create({ projectId: req.params.projectId, actor: { userId: req.user.sub, role: req.user.role }, jti: req.user.jti, expiresAt: Number(req.user.exp) * 1000 }));
    }, { prefix: '/api/v1' });
    registerProjectRealtime(app, tickets, discussion, ['http://collaboration.test'],
      new RealtimeSocketLeases(new LocalRealtimeSocketLeaseStore(), () => randomBytes(16).toString('hex')), wakeSource);
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address(); assert(address && typeof address !== 'string');

    await t.test('HTTP authorization uses primary across two instances after logout/role/account changes', async () => {
      const account = await prisma.user.create({ data: { email: 'capacity-auth@example.invalid',
        passwordHash: randomBytes(32).toString('hex'), role: 'admin' } });
      const secret = randomBytes(32).toString('hex');
      const servers = [Fastify(), Fastify()];
      try {
        for (const server of servers) {
          server.decorate('config', { auth: { jwtSecret: secret } } as AppConfig);
          server.decorate('prisma', prisma);
          await server.register(jwtPlugin);
          server.get('/probe', { preHandler: server.auth.verify }, req => ({ role: req.user.role }));
          server.get('/admin', { preHandler: server.auth.requireAdmin }, () => ({ ok: true }));
        }
        const jti = randomUUID();
        const token = servers[0].jwt.sign({ sub: account.id, jti, role: 'admin', email: account.email }, { expiresIn: '1h' });
        const headers = { authorization: `Bearer ${token}` };
        const batch = await new PrismaTokenSessionReader(prisma).readMany(Array.from({ length: 200 }, () => ({ userId: account.id, jti })));
        assert.equal(batch.length, 200);
        assert(batch.every(entry => entry?.userId === account.id && entry.role === 'admin' && !entry.revoked));
        assert.equal((await servers[1].inject({ url: '/admin', headers })).statusCode, 200);
        await prisma.user.update({ where: { id: account.id }, data: { role: 'student' } });
        assert.equal((await servers[1].inject({ url: '/admin', headers })).statusCode, 403);
        assert.equal((await servers[1].inject({ url: '/probe', headers })).json().role, 'student');
        await prisma.user.update({ where: { id: account.id }, data: { isActive: false } });
        assert.equal((await servers[1].inject({ url: '/probe', headers })).statusCode, 401);
        await prisma.user.update({ where: { id: account.id }, data: { isActive: true } });
        await prisma.invalidToken.create({ data: { jti, userId: account.id, expiresAt: new Date(Date.now() + 3600000) } });
        servers[0].tokenRevocationCache.set(jti, 'revoked');
        assert.equal((await servers[1].inject({ url: '/probe', headers })).json().error.code, 'TOKEN_REVOKED');
      } finally { await Promise.all(servers.map(server => server.close())); }
    });
    const wsUrl = `ws://127.0.0.1:${address.port}/api/v1/projects/${p.id}/realtime`;
    const tokens: Record<string, string> = {};
    for (const [label, a] of Object.entries(actors)) tokens[label] = app.jwt.sign({ sub: a.userId, jti: randomUUID(), role: a.role, email: `${label}@example.invalid` }, { expiresIn: '15m' });
    const call = (label: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, payload?: unknown) =>
      app.inject({ method, url: `/api/v1${url}`, headers: { authorization: `Bearer ${tokens[label]}` }, ...(payload !== undefined ? { payload: payload as Record<string, unknown> } : {}) });
    const links: Record<string, Awaited<ReturnType<typeof sharing.create>>> = {};
    await t.test('owner creates three roles; non-owner/admin cannot manage sharing; hash stays private', async () => {
      for (const role of ['viewer', 'commenter', 'editor'] as const) {
        const r = await call('owner', 'POST', `/projects/${p.id}/share-links`, { role, expiresAt: null });
        assert.equal(r.statusCode, 201, r.body); const body = r.json(); assert(!JSON.stringify(body).includes('tokenHash'));
        links[role] = { link: await prisma.projectShareLink.findUniqueOrThrow({ where: { id: body.link.id } }), token: body.shareUrl.split('#token=')[1] };
        assert(!JSON.stringify((await call('owner', 'GET', `/projects/${p.id}/share-links`)).json()).includes(links[role].token));
        for (const label of ['viewer', 'admin']) assert.equal((await call(label, 'POST', `/projects/${p.id}/share-links`, { role, expiresAt: null })).statusCode, 403);
      }
    });
    await t.test('resolve has no side effect; concurrent redeem is unique and role capabilities follow membership', async () => {
      await sharing.receive(viewer, links.viewer.link.id, links.viewer.token, false);
      assert.equal(await prisma.projectMember.count(), 0);
      await Promise.all([sharing.receive(viewer, links.viewer.link.id, links.viewer.token, true), sharing.receive(viewer, links.viewer.link.id, links.viewer.token, true)]);
      await sharing.receive(commenter, links.commenter.link.id, links.commenter.token, true);
      await sharing.receive(editor, links.editor.link.id, links.editor.token, true);
      assert.equal(await prisma.projectAccessGrant.count(), 3);
      for (const label of ['viewer', 'commenter', 'editor']) {
        const r = await call(label, 'GET', `/projects/${p.id}`); assert.equal(r.statusCode, 200, r.body);
        assert.equal(r.json().access.level, label); assert.equal(r.json().access.canEdit, label === 'editor'); assert.equal(r.json().access.canComment, label !== 'viewer');
        assert.equal(r.json().access.canManageSharing, false);
      }
      assert.equal((await call('outsider', 'GET', `/projects/${p.id}`)).statusCode, 403);
      assert.equal((await call('viewer', 'GET', '/projects/shared')).json().projects[0].id, p.id);
    });
    const file = await fileRepo.create({ projectId: p.id, path: 'main.typ', kind: FileKind.Typst, content: 'A😀B\n', storageMode: 'inline', sha256: '', sizeBytes: 7 });
    await t.test('CAS HTTP rejects missing versions and viewer writes; two editors saving one version have one winner', async () => {
      assert.equal((await call('editor', 'PUT', `/projects/${p.id}/files/main.typ`, { content: 'bad' })).statusCode, 428);
      assert.equal((await call('viewer', 'PUT', `/projects/${p.id}/files/main.typ`, { content: 'bad', fileId: file.id, baseRevision: 1 })).statusCode, 403);
      const r = await Promise.all(['first', 'second'].map(content => call('editor', 'PUT', `/projects/${p.id}/files/main.typ`, { content, fileId: file.id, baseRevision: 1 })));
      assert.deepEqual(r.map(x => x.statusCode).sort(), [200, 409]);
      assert.equal(r.find(x => x.statusCode === 200)!.json().revision, 2);
      assert.equal((await call('editor', 'PATCH', `/projects/${p.id}/files:rename?path=main.typ`, { newPath: 'other.typ', fileId: file.id, baseRevision: 1 })).statusCode, 409);
      assert.equal((await call('editor', 'DELETE', `/projects/${p.id}/files/main.typ?fileId=${file.id}&baseRevision=1`)).statusCode, 409);
      const r2 = await Promise.all(['Title 1', 'Title 2'].map(title => call('editor', 'PUT', `/projects/${p.id}`, { title, baseRevision: 1 })));
      assert.deepEqual(r2.map(x => x.statusCode).sort(), [200, 409]);
      assert.equal((await call('editor', 'DELETE', `/projects/${p.id}`)).statusCode, 403);
    });
    await t.test('settings CAS/redaction and export/official compile access match the three roles', async () => {
      await containers.getSettingsRepo().findOrCreate(p.id);
      const r = await Promise.all([100, 200].map(ppi => call('editor', 'PUT', `/projects/${p.id}/settings`, { compileOptions: { ppi }, baseRevision: 1 })));
      assert.deepEqual(r.map(x => x.statusCode).sort(), [200, 409]);
      assert.equal((await call('viewer', 'PUT', `/projects/${p.id}/settings`, { mainPath: 'main.typ', baseRevision: 2 })).statusCode, 403);
      assert.equal((await call('editor', 'PUT', `/projects/${p.id}/settings`, { zoteroConfig: { private: true }, baseRevision: 2 })).statusCode, 403);
      const ca = new PrismaCompileAccessRepository(prisma), pa = new PrismaProjectAccessRepository(prisma);
      for (const a of [viewer, commenter]) { await assert.rejects(ca.requireOfficialCompileAccess(p.id, a.userId, a.role)); await assert.rejects(pa.requireExportAccess(p.id, a.userId)); }
      await ca.requireOfficialCompileAccess(p.id, editor.userId, editor.role); await pa.requireExportAccess(p.id, editor.userId);
      await prisma.projectSettings.update({ where: { projectId: p.id }, data: { zoteroConfig: { privateValue: randomUUID() } } });
      const settings = (await call('editor', 'GET', `/projects/${p.id}/settings`)).json().settings;
      assert.equal(settings.zoteroConfig, null); assert.equal(typeof settings.revision, 'number');
      const patch = await call('editor', 'PUT', `/projects/${p.id}/settings`, { compileOptions: { ppi: 144 }, baseRevision: 2 });
      assert.equal(patch.statusCode, 200, patch.body); assert.equal(patch.json().settings.zoteroConfig, null);
    });
    let messageId = '';
    await t.test('chat persists once on retry; wrong body/key conflicts; authors and project scopes enforced', async () => {
      const clientMessageId = randomUUID(); const sent = await Promise.all([0, 1].map(() => call('viewer', 'POST', `/projects/${p.id}/chat/messages`, { clientMessageId, body: '<script> text literal' })));
      assert.deepEqual(sent.map(r => r.statusCode).sort(), [200, 201]); messageId = sent[0].json().message.id;
      assert.equal(await prisma.projectChatMessage.count(), 1);
      assert.equal((await call('viewer', 'POST', `/projects/${p.id}/chat/messages`, { clientMessageId, body: 'different' })).statusCode, 409);
      assert.equal((await call('editor', 'DELETE', `/projects/${p.id}/chat/messages/${messageId}`)).statusCode, 403);
      assert.equal((await call('owner', 'DELETE', `/projects/${other.id}/chat/messages/${messageId}`)).statusCode, 404);
      assert.equal((await call('admin', 'GET', `/projects/${p.id}/chat/messages`)).statusCode, 403);
      assert.equal((await call('owner', 'GET', `/projects/${p.id}/chat/read-state`)).json().unreadCount, 1);
      const seq = sent[0].json().message.seq;
      await call('owner', 'PUT', `/projects/${p.id}/chat/read-state`, { lastReadMessageSeq: seq });
      await call('owner', 'PUT', `/projects/${p.id}/chat/read-state`, { lastReadMessageSeq: '0' });
      assert.equal((await call('owner', 'GET', `/projects/${p.id}/chat/read-state`)).json().lastReadMessageSeq, seq);
      await call('viewer', 'DELETE', `/projects/${p.id}/chat/messages/${messageId}`);
      const replay = (await call('owner', 'GET', `/projects/${p.id}/events?since=0`)).body;
      assert(!replay.includes('<script>')); assert(replay.includes('chat.message.deleted'));
      assert.equal((await call('viewer', 'POST', `/projects/${p.id}/chat/messages`, { clientMessageId, body: 'original retry' })).json().message.body, null);
    });
    await t.test('comments validate Unicode saved anchors, source unchanged, viewer denied, thread CAS and file deletion preserved', async () => {
      const fresh = await fileRepo.findByProjectIdAndPath(p.id, 'main.typ'); assert(fresh);
      await fileRepo.update({ projectId: p.id, path: 'main.typ', actorId: owner.userId, fileId: file.id, baseRevision: fresh.revision, content: 'A😀B\n', sizeBytes: 7, sha256: '' });
      const anchor = { kind: 'range', fileId: file.id, baseRevision: 3, from: 1, to: 3, quote: '😀' };
      const body = { clientCommentId: randomUUID(), body: 'Unicode range', anchor };
      assert.equal((await call('viewer', 'POST', `/projects/${p.id}/comments/threads`, body)).statusCode, 403);
      const response = await call('commenter', 'POST', `/projects/${p.id}/comments/threads`, body); assert.equal(response.statusCode, 201, response.body);
      const thread = response.json().thread;
      const split = await call('commenter', 'POST', `/projects/${p.id}/comments/threads`, { ...body, clientCommentId: randomUUID(), anchor: { ...anchor, to: 2, quote: '\ud83d' } });
      assert.equal(split.statusCode, 400, split.body);
      assert.equal((await call('commenter', 'POST', `/projects/${p.id}/comments/threads`, { ...body, anchor: { kind: 'project' } })).statusCode, 409);
      assert.equal((await fileRepo.findByProjectIdAndPath(p.id, 'main.typ'))?.textContent, 'A😀B\n');
      assert.equal((await call('commenter', 'POST', `/projects/${p.id}/comments/threads`, { ...body, clientCommentId: randomUUID(), anchor: { ...anchor, baseRevision: 1 } })).statusCode, 409);
      assert.equal((await call('editor', 'PATCH', `/projects/${p.id}/comments/threads/${thread.id}`, { baseRevision: 1, state: 'resolved' })).statusCode, 200);
      assert.equal((await call('commenter', 'POST', `/projects/${p.id}/comments/threads/${thread.id}/replies`, { clientCommentId: randomUUID(), body: 'no' })).statusCode, 409);
      assert.equal((await call('commenter', 'PATCH', `/projects/${p.id}/comments/threads/${thread.id}`, { baseRevision: 1, state: 'open' })).statusCode, 409);
      await call('commenter', 'PATCH', `/projects/${p.id}/comments/threads/${thread.id}`, { baseRevision: 2, state: 'open' });
      const replyId = randomUUID(); await Promise.all([0, 1].map(() => discussion.reply(p.id, commenter, thread.id, replyId, 'Reply')));
      assert.equal(await prisma.projectComment.count({ where: { threadId: thread.id } }), 2);
      await fileRepo.rename({ projectId: p.id, actorId: owner.userId, oldPath: 'main.typ', newPath: 'renamed.typ', fileId: file.id, baseRevision: 3 });
      let list = await discussion.threads(p.id, owner); assert.equal(list.threads[0].filePath, 'renamed.typ');
      await fileRepo.delete(p.id, 'renamed.typ', { actorId: owner.userId, fileId: file.id, baseRevision: 4 });
      list = await discussion.threads(p.id, owner); assert.equal(list.threads[0].anchorStatus, 'file_deleted');
      const recreated = await fileRepo.create({ projectId: p.id, path: 'renamed.typ', kind: FileKind.Typst, content: 'Replacement', storageMode: 'inline', sizeBytes: 11, sha256: '' });
      assert.notEqual(recreated.id, file.id);
      assert.equal((await call('editor', 'PUT', `/projects/${p.id}/files/renamed.typ`, { fileId: file.id, baseRevision: 1, content: 'old draft' })).statusCode, 409);
      assert.equal((await fileRepo.findByProjectIdAndPath(p.id, 'renamed.typ'))?.textContent, 'Replacement');
    });
    await t.test('cross-project composite FKs and failed transactions cannot leave messages/events behind', async () => {
      const otherLink = await sharing.create(other.id, owner, { role: 'viewer', expiresAt: null });
      const member = await prisma.projectMember.findUniqueOrThrow({ where: { projectId_userId: { projectId: p.id, userId: viewer.userId } } });
      await assert.rejects(prisma.projectAccessGrant.create({ data: { projectId: p.id, memberId: member.id, shareLinkId: otherLink.link.id } }));
      const head = (await prisma.projectCollaborationState.findUniqueOrThrow({ where: { projectId: p.id } })).lastEventSeq;
      await assert.rejects(discussionRepo.run(p.id, owner, async tx => { await tx.send(randomUUID(), 'rolled back'); throw new Error('rollback fixture'); }));
      assert.equal((await prisma.projectCollaborationState.findUniqueOrThrow({ where: { projectId: p.id } })).lastEventSeq, head);
      assert.equal(await prisma.projectChatMessage.count({ where: { body: 'rolled back' } }), 0);
    });
    await t.test('schema-scoped wake hints publish only after commit, coalesce transaction bursts, and stay silent on rollback', async () => {
      const project = await prisma.project.create({ data: { title: 'Wake transaction fixture', category: 'other', ownerId: owner.userId } });
      const received: string[] = [], unsubscribe = wakeSource.subscribe(id => received.push(id));
      let release!: () => void, entered!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      const started = new Promise<void>(resolve => { entered = resolve; });
      const pending = discussionRepo.run(project.id, owner, async tx => {
        await tx.send(randomUUID(), 'Committed first'); await tx.send(randomUUID(), 'Committed second');
        entered(); await gate;
      });
      try {
        await started;
        await new Promise(resolve => setTimeout(resolve, 100));
        assert(!received.includes(project.id), 'Notification must not precede transaction commit');
        release(); await pending;
        await waitUntil(() => received.includes(project.id), 1000);
        assert.equal(received.filter(id => id === project.id).length, 1, 'PostgreSQL coalesces matching hints inside a transaction');
        received.length = 0;
        await assert.rejects(discussionRepo.run(project.id, owner, async tx => {
          await tx.send(randomUUID(), 'Rollback wake'); throw new Error('rollback wake fixture');
        }));
        // Wrong schemas and malformed hints cannot trigger a room pump.
        await pool.query("SELECT pg_notify('project_events_' || md5($1), $2)", [schema, '{invalid-payload}']);
        await pool.query("SELECT pg_notify('project_events_' || md5($1), $2)", [`${schema}_other`, project.id]);
        await new Promise(resolve => setTimeout(resolve, 100));
        assert.equal(received.length, 0);
        assert.equal(await prisma.projectChatMessage.count({ where: { projectId: project.id } }), 2);
      } finally { release(); await pending; unsubscribe(); }
    });
    await t.test('dedicated LISTEN session reconnects and resubscribes after its own database connection is terminated', async () => {
      const listener = await admin.query<{ pid: number }>('SELECT pid FROM pg_stat_activity WHERE application_name = $1 AND datname = current_database()', [`${schema}_wake`]);
      assert.equal(listener.rows.length, 1, 'Only the scratch test listener may be terminated');
      const pid = listener.rows[0].pid;
      await admin.query('SELECT pg_terminate_backend($1)', [pid]);
      const received: string[] = [], unsubscribe = wakeSource.subscribe(id => received.push(id));
      try {
        const deadline = Date.now() + 3000;
        while (!received.includes(other.id) && Date.now() < deadline) {
          await pool.query("SELECT pg_notify('project_events_' || md5(current_schema()), $1)", [other.id]);
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert(received.includes(other.id), 'Reconnected listener must resubscribe to the scratch schema channel');
      } finally { unsubscribe(); }
    });
    await t.test('readonly replay and access do not create state or wait for an uncommitted project mutation lock', async () => {
      const project = await prisma.project.create({ data: { title: 'Readonly replay fixture', category: 'other', ownerId: owner.userId } });
      assert.equal(await prisma.projectCollaborationState.count({ where: { projectId: project.id } }), 0);
      assert.deepEqual((await discussion.events(project.id, owner, '0')).events, []);
      assert.equal((await sharing.access(project.id, owner)).level, 'owner');
      assert.equal(await prisma.projectCollaborationState.count({ where: { projectId: project.id } }), 0);
      const initial = await discussion.send(project.id, owner, randomUUID(), 'Committed snapshot');
      let release!: () => void, entered!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      const started = new Promise<void>(resolve => { entered = resolve; });
      const pending = discussionRepo.run(project.id, owner, async tx => {
        await tx.send(randomUUID(), 'Uncommitted mutation'); entered(); await gate;
      });
      try {
        await started;
        let replay: Awaited<ReturnType<typeof discussion.events>> | undefined;
        const reading = discussion.events(project.id, owner, '0').then(value => { replay = value; });
        await waitUntil(() => replay !== undefined, 1000);
        await reading;
        let access: Awaited<ReturnType<typeof sharing.access>> | undefined;
        const readingAccess = sharing.access(project.id, owner).then(value => { access = value; });
        await waitUntil(() => access !== undefined, 1000);
        await readingAccess;
        assert.equal(access!.level, 'owner');
        assert.equal(replay!.highWatermark, initial.message.seq);
        assert.equal(replay!.events.length, 1);
        assert(!JSON.stringify(replay).includes('Uncommitted mutation'));
      } finally { release(); await pending; }
    });
    await t.test('access and batched realtime immediately observe link expiry, scope, account and revocation changes', async () => {
      const project = await prisma.project.create({ data: { title: 'Access read fixture', category: 'other', ownerId: owner.userId } });
      const futureExpiry = new Date(Date.now() + 60_000).toISOString();
      const link = await sharing.create(project.id, owner, { role: 'viewer', expiresAt: futureExpiry });
      await sharing.receive(viewer, link.link.id, link.token, true);
      const policy = new PrismaRealtimeSessionPolicy(prisma);
      const session = { projectId: project.id, actor: viewer, jti: randomUUID(), expiresAt: Date.now() + 60_000 };
      assert.deepEqual(await Promise.all([policy.validate(session), policy.validate({ ...session, projectId: other.id })]), [true, false]);
      assert.equal((await sharing.access(project.id, viewer)).level, 'viewer');
      assert.equal((await sharing.access(project.id, viewer)).validUntil, futureExpiry, 'JSON timestamp projection must preserve the UTC instant');
      await prisma.projectShareLink.update({ where: { id: link.link.id }, data: { expiresAt: new Date(0) } });
      await assert.rejects(sharing.access(project.id, viewer));
      assert.equal(await policy.validate(session), false);
      await prisma.projectShareLink.update({ where: { id: link.link.id }, data: { expiresAt: null } });
      await prisma.user.update({ where: { id: viewer.userId }, data: { mustChangePassword: true } });
      try {
        await assert.rejects(sharing.access(project.id, viewer));
        assert.equal(await policy.validate(session), false);
      } finally { await prisma.user.update({ where: { id: viewer.userId }, data: { mustChangePassword: false } }); }
      assert.equal(await policy.validate(session), true);
      await sharing.revoke(project.id, link.link.id, owner);
      await assert.rejects(sharing.access(project.id, viewer));
      assert.equal(await policy.validate(session), false);
    });
    await t.test('mixed chat and reply replay hydrates with constant SQL query count for 20 versus 100 events', async () => {
      const project = await prisma.project.create({ data: { title: 'Replay query fixture', category: 'other', ownerId: owner.userId } });
      const thread = await discussion.createThread(project.id, owner, randomUUID(), 'Root comment', { kind: 'project' });
      await discussionRepo.run(project.id, owner, async tx => {
        for (let i = 0; i < 99; i++) {
          if (i % 2) await tx.addComment(thread.id, randomUUID(), `Reply ${i}`);
          else await tx.send(randomUUID(), `Message ${i}`);
        }
      });
      const beforeSmall = queryCount;
      const small = await discussion.events(project.id, owner, '0', 20), smallQueries = queryCount - beforeSmall;
      const beforeLarge = queryCount;
      const large = await discussion.events(project.id, owner, '0', 100), largeQueries = queryCount - beforeLarge;
      assert.equal(small.events.length, 20); assert.equal(large.events.length, 100);
      assert.equal(largeQueries, smallQueries, 'Hydration queries must not grow with event count');
      const reply = large.events.find(event => event.type === 'comment.reply.created')!.data as { thread: { comments: { body: string }[]; commentsNextCursor: string }; comment: { body: string } };
      assert.equal(reply.thread.comments.length, 2);
      assert.equal(reply.thread.comments[0].body, 'Root comment');
      assert(reply.comment.body.startsWith('Reply ')); assert(reply.thread.commentsNextCursor);
      t.diagnostic(`Actual SQL queries for mixed replay: 20 events = ${smallQueries}; 100 events = ${largeQueries}.`);
    });
    await t.test('batch replay isolates private read-state, failures and cursor results on real PostgreSQL', async () => {
      const project = await prisma.project.create({ data: { title: 'Batch private-state fixture', category: 'other', ownerId: owner.userId } });
      const recipients = await Promise.all(['a', 'b', 'oversight'].map(async label => {
        const account = await prisma.user.create({ data: { email: `batch-state-${label}@example.invalid`,
          passwordHash: randomBytes(32).toString('hex'), role: label === 'oversight' ? 'admin' : 'student' } });
        return { userId: account.id, role: 'student' as const };
      }));
      const [a, b, oversight] = recipients;
      await prisma.projectMember.createMany({ data: [a, b].map(actor => ({ projectId: project.id, userId: actor.userId, roleOverride: 'viewer' })) });
      const first = await discussion.send(project.id, owner, randomUUID(), 'Owner private-state fixture');
      const second = await discussion.send(project.id, a, randomUUID(), 'Recipient a message');
      await discussion.send(project.id, b, randomUUID(), 'Recipient b message');
      const expected = new Map([
        [owner.userId, await discussion.readState(project.id, owner, first.message.seq)],
        [a.userId, await discussion.readState(project.id, a, first.message.seq)],
        [b.userId, await discussion.readState(project.id, b, second.message.seq)],
      ]);
      assert.deepEqual([...expected.values()].map(value => value.unreadCount), [2, 1, 0]);
      const requested = [owner, a, b, oversight, owner];
      const batch = await discussion.eventsBatch(project.id, requested, '0');
      assert.equal(batch.length, 4, 'Repeated sockets of the same user share one projection');
      for (const actor of [owner, a, b]) {
        const entry = batch.find(value => value.userId === actor.userId)!;
        assert('result' in entry, 'An oversight denial must not reject room peers');
        assert.deepEqual(entry.result, await discussion.events(project.id, actor, '0'));
        const readEvents = entry.result.events.filter(event => event.type === 'chat.read.changed');
        assert.equal(readEvents.length, 3, 'Foreign private events still preserve the sequence/cursor contract');
        assert.deepEqual(readEvents.map(event => event.data), [owner, a, b].map(who => who.userId === actor.userId ? expected.get(who.userId) : {}));
        assert(readEvents.every(event => !('actorId' in event)), 'Internal routing identifiers must not enter EventView');
      }
      const denied = batch.find(value => value.userId === oversight.userId)!;
      assert('error' in denied); assert.equal((denied.error as { code?: string }).code, 'PROJECT_ACCESS_DENIED');
      const page = await discussion.eventsBatch(project.id, [owner, b], first.message.seq, 1);
      for (const entry of page) {
        assert('result' in entry);
        assert.deepEqual(entry.result.events.map(event => event.seq), [second.message.seq]);
        assert.equal(entry.result.nextCursor, second.message.seq); assert.equal(entry.result.hasMore, true);
      }
      const head = (await discussion.events(project.id, owner, '0')).highWatermark;
      const upToDate = await discussion.eventsBatch(project.id, [owner, b], head);
      assert(upToDate.every(entry => 'result' in entry && entry.result.events.length === 0 && entry.result.nextCursor === head));
      const ahead = await discussion.eventsBatch(project.id, [owner, b], (BigInt(head) + 1n).toString());
      assert(ahead.every(entry => 'error' in entry && (entry.error as { code?: string }).code === 'INVALID_CURSOR'));
      const member = await prisma.projectMember.findUniqueOrThrow({ where: { projectId_userId: { projectId: project.id, userId: a.userId } } });
      await sharing.changeMember(project.id, member.id, owner, {}, true);
      const afterBlock = await discussion.eventsBatch(project.id, [a, b, owner], '0');
      assert('error' in afterBlock.find(entry => entry.userId === a.userId)!);
      const version = (await sharing.access(project.id, owner)).version;
      for (const actor of [owner, b]) {
        const entry = afterBlock.find(value => value.userId === actor.userId)!;
        assert('result' in entry); assert(entry.result.events.every(event => event.accessVersion === version));
      }
      await prisma.user.update({ where: { id: b.userId }, data: { mustChangePassword: true } });
      try {
        const reset = await discussion.eventsBatch(project.id, [owner, b], '0');
        assert('result' in reset.find(entry => entry.userId === owner.userId)!);
        assert('error' in reset.find(entry => entry.userId === b.userId)!);
      } finally { await prisma.user.update({ where: { id: b.userId }, data: { mustChangePassword: false } }); }
    });
    await t.test('separate batch snapshots hydrate current author, comment revision, file anchor and tombstones', async () => {
      const project = await prisma.project.create({ data: { title: 'Fresh batch hydration fixture', category: 'other', ownerId: owner.userId } });
      const account = await prisma.user.create({ data: { email: 'batch-deleted-author@example.invalid', role: 'student', passwordHash: randomBytes(32).toString('hex') } });
      const author: ProjectActor = { userId: account.id, role: 'student' };
      await prisma.projectMember.create({ data: { projectId: project.id, userId: author.userId, roleOverride: 'commenter' } });
      const source = await fileRepo.create({ actorId: owner.userId, projectId: project.id, path: 'batch.typ', kind: FileKind.Typst,
        content: 'A😀B\n', storageMode: 'inline', sizeBytes: 7, sha256: 'fixture-only' });
      assert.equal(typeof source.revision, 'number'); assert(source.revision !== undefined);
      const message = await discussion.send(project.id, author, randomUUID(), 'Batch retained message');
      const thread = await discussion.createThread(project.id, author, randomUUID(), 'Batch private root body',
        { kind: 'range', fileId: source.id, baseRevision: source.revision, from: 1, to: 3, quote: '😀' });
      const reply = await discussion.reply(project.id, author, thread.id, randomUUID(), 'Batch old reply body');
      const read = async () => {
        const entry = (await discussion.eventsBatch(project.id, [owner], '0'))[0]; assert('result' in entry); return entry.result;
      };
      const before = await read();
      assert.equal((before.events.find(event => event.type === 'comment.reply.created')!.data as { comment: CommentView }).comment.revision, 1);
      await prisma.user.delete({ where: { id: author.userId } });
      const afterAuthor = await discussion.eventsBatch(project.id, [owner, author], '0');
      assert('error' in afterAuthor.find(entry => entry.userId === author.userId)!);
      const surviving = afterAuthor.find(entry => entry.userId === owner.userId)!; assert('result' in surviving);
      const retained = (surviving.result.events.find(event => event.type === 'chat.message.created')!.data as { message: MessageView }).message;
      assert.equal(retained.author.id, null); assert.equal(retained.author.displayName, 'Người dùng đã xóa'); assert.equal(retained.body, 'Batch retained message');
      const edited = await discussion.changeComment(project.id, owner, reply.id, reply.revision, 'Batch edited reply body');
      const renamed = await fileRepo.rename({ actorId: owner.userId, projectId: project.id, fileId: source.id,
        baseRevision: source.revision, oldPath: source.path, newPath: 'batch-renamed.typ' });
      const current = await read();
      const updated = current.events.find(event => event.type === 'comment.reply.created')!.data as { comment: CommentView; thread: ThreadView };
      assert.equal(updated.comment.body, 'Batch edited reply body'); assert.equal(updated.comment.revision, edited.revision);
      assert.equal(updated.comment.author.id, null); assert.equal(updated.thread.createdById, null);
      assert.equal(updated.thread.anchorStatus, 'stale'); assert.equal(updated.thread.filePath, 'batch-renamed.typ');
      assert.equal(updated.thread.revision, 3, 'Thread revision includes reply creation and editing');
      await fileRepo.delete(project.id, renamed.path, { actorId: owner.userId, fileId: renamed.id, baseRevision: renamed.revision });
      const missing = (await read()).events.find(event => event.type === 'comment.thread.created')!.data as { thread: ThreadView };
      assert.equal(missing.thread.anchorStatus, 'file_deleted');
      const latestThread = (await discussion.threads(project.id, owner)).threads.find(value => value.id === thread.id)!;
      await discussion.changeThread(project.id, owner, thread.id, latestThread.revision, undefined, true);
      await discussion.deleteMessage(project.id, owner, message.message.id);
      const final = await read();
      const tombstoneMessage = (final.events.find(event => event.type === 'chat.message.created')!.data as { message: MessageView }).message;
      assert.equal(tombstoneMessage.body, null); assert(tombstoneMessage.deletedAt);
      const tombstone = final.events.find(event => event.type === 'comment.reply.created')!.data as { comment: CommentView; thread: ThreadView };
      assert.equal(tombstone.comment.body, null); assert(tombstone.comment.deletedAt);
      assert.deepEqual(tombstone.thread.anchor, { kind: 'project' }); assert.equal(tombstone.thread.filePath, null);
      assert(tombstone.thread.comments.every(comment => comment.body === null && comment.deletedAt));
      assert(!JSON.stringify(final).includes('Batch private root body')); assert(!JSON.stringify(final).includes('Batch edited reply body'));
      assert.equal((before.events.find(event => event.type === 'chat.message.created')!.data as { message: MessageView }).message.body,
        'Batch retained message', 'A later read must not mutate an already returned snapshot');
    });
    await t.test('100 native room recipients require two current payload hydrations per committed page', { timeout: 20_000 }, async () => {
      const project = await prisma.project.create({ data: { title: 'Hot room cohort fixture', category: 'other', ownerId: owner.userId } });
      const people: ProjectActor[] = Array.from({ length: 100 }, () => ({ userId: randomUUID(), role: 'student' }));
      await prisma.user.createMany({ data: people.map((person, index) => ({ id: person.userId,
        email: `cohort-hot-${index}@example.invalid`, role: 'student', passwordHash: randomBytes(32).toString('hex') })) });
      await prisma.projectMember.createMany({ data: people.map(person => ({ projectId: project.id, userId: person.userId, roleOverride: 'viewer' })) });
      const initial = await discussion.send(project.id, owner, randomUUID(), 'Hot room baseline');
      const issued = await Promise.all(people.map(actor => tickets.create({ projectId: project.id, actor, jti: randomUUID(), expiresAt: Date.now() + 60_000 })));
      const server = Fastify(), controlledWake = new ControlledProjectWakeSource();
      const sockets = new Set<WebSocket>(), queries: string[] = [], validated = new Set<string>();
      const metrics = new ServiceMetrics(); server.decorate('serviceMetrics', metrics);
      let measuring = false, held = 0, release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      const observe = (query: string) => { queries.push(query); };
      registerProjectRealtime(server, { consume: tickets.consume.bind(tickets), validate: async session => {
        const valid = await tickets.validate(session); validated.add(session.actor.userId); return valid;
      } }, { events: discussion.events.bind(discussion), eventsBatch: async (...args) => {
        const result = await discussion.eventsBatch(...args);
        if (measuring) { held++; await gate; }
        return result;
      } }, ['http://collaboration.test'],
      new RealtimeSocketLeases(new LocalRealtimeSocketLeaseStore(), () => randomBytes(16).toString('hex')), controlledWake);
      try {
        await server.listen({ host: '127.0.0.1', port: 0 });
        const location = server.server.address(); assert(location && typeof location !== 'string');
        const url = `ws://127.0.0.1:${location.port}/api/v1/projects/${project.id}/realtime`;
        const clients = await Promise.all(issued.map(ticket => connectRealtime(url, ticket.ticket, initial.message.seq, sockets)));
        // All 100 sockets must finish their empty initial replay before counting the next commit.
        // The initial handshake itself is deliberately not used as a deterministic cohort benchmark.
        await waitUntil(() => validated.size === people.length);
        measuring = true;
        queryObservers.add(observe);
        const sent = await discussionRepo.run(project.id, people[0], async tx => {
          const message = await tx.send(randomUUID(), 'Hot room committed delivery');
          await tx.readState(message.seq);
          return message;
        });
        const head = (await prisma.projectCollaborationState.findUniqueOrThrow({ where: { projectId: project.id } })).lastEventSeq.toString();
        controlledWake.wake(project.id);
        await waitUntil(() => held === 2);
        const duringReplay = await metrics.registry.metrics();
        assert.match(duringReplay, /tlu_realtime_state\{state="activeReplays"\} 2\b/);
        assert.match(duringReplay, /tlu_realtime_state\{state="activeReplayRecipients"\} 100\b/);
        for (const person of people) assert(!duringReplay.includes(person.userId), 'Metrics must not label recipients');
        assert(!duringReplay.includes(project.id), 'Metrics must not label rooms');
        release();
        await waitUntil(() => clients.every(client => client.sequences().includes(head)));
        queryObservers.delete(observe);
        const eventQueries = queries.filter(query => /^SELECT\b/.test(query) && query.includes('"ProjectEvent"'));
        const messageHydrations = queries.filter(query => /^SELECT\b/.test(query) && query.includes('"ProjectChatMessage"') && !/\bCOUNT\s*\(/i.test(query));
        assert.equal(eventQueries.length, 2, '100 recipients at the same cursor must scan two frozen cohorts of at most 50');
        assert.equal(messageHydrations.length, 2, 'Payload hydration must follow cohort count instead of recipient count');
        for (const [index, client] of clients.entries()) {
          assert.deepEqual(client.sequences(), [sent.seq, head]);
          const stateEvent = client.frames.flatMap(frame => frame.events ?? []).find(event => event.type === 'chat.read.changed')!;
          assert.deepEqual(stateEvent.data, index === 0 ? { lastReadMessageSeq: sent.seq, unreadCount: 0 } : {},
            'Sharing hydration must not share the sender private read-state with the other 99 native recipients');
        }
        t.diagnostic(`Actual hot-room SQL: recipients=${clients.length}; event scans=${eventQueries.length}; message hydrations=${messageHydrations.length}`);
      } finally { release(); queryObservers.delete(observe); for (const socket of sockets) socket.terminate(); await server.close(); metrics.close(); }
    });
    await t.test('native room replay keeps distinct bigint cursors and rejects only the ahead-of-head socket', async () => {
      const project = await prisma.project.create({ data: { title: 'Mixed bigint cursor fixture', category: 'other', ownerId: owner.userId } });
      await discussion.send(project.id, owner, randomUUID(), 'Bigint cursor initial');
      const base = 9007199254740993n;
      await prisma.projectCollaborationState.update({ where: { projectId: project.id }, data: { lastEventSeq: base } });
      const sent = await discussionRepo.run(project.id, owner, async tx => {
        const messages: MessageView[] = [];
        for (let index = 0; index < 3; index++) messages.push(await tx.send(randomUUID(), `Bigint cohort message ${index}`));
        return messages;
      });
      const issued = await Promise.all(Array.from({ length: 4 }, () => tickets.create({ projectId: project.id, actor: owner,
        jti: randomUUID(), expiresAt: Date.now() + 60_000 })));
      const cursors = [base.toString(), sent[1].seq, sent[2].seq, (BigInt(sent[2].seq) + 1n).toString()];
      const sockets = new Set<WebSocket>();
      try {
        const clients = await Promise.all(issued.map((ticket, index) => connectRealtime(
          `ws://127.0.0.1:${address.port}/api/v1/projects/${project.id}/realtime`, ticket.ticket, cursors[index], sockets)));
        await waitUntil(() => clients[0].sequences().length === 3 && clients[1].sequences().length === 1 && clients[3].closeCode() === 4403);
        assert.deepEqual(clients[0].sequences(), sent.map(message => message.seq));
        assert.deepEqual(clients[1].sequences(), [sent[2].seq]);
        assert.deepEqual(clients[2].sequences(), []); assert.equal(clients[2].socket.readyState, WebSocket.OPEN);
        assert.deepEqual(clients[3].sequences(), []);
        assert.equal(clients[0].frames.find(frame => frame.type === 'events')!.highWatermark, sent[2].seq);
        assert.equal(clients[1].frames.find(frame => frame.type === 'events')!.nextCursor, sent[2].seq);
      } finally { for (const socket of sockets) socket.terminate(); }
    });
    await t.test('post-snapshot revoke, lease loss and socket close cannot leak a grouped native replay to invalid peers', { timeout: 15_000 }, async () => {
      const project = await prisma.project.create({ data: { title: 'Grouped send barriers fixture', category: 'other', ownerId: owner.userId } });
      const peers = await Promise.all(['revoked', 'lost-lease', 'closed'].map(async label => {
        const account = await prisma.user.create({ data: { email: `cohort-barrier-${label}@example.invalid`,
          role: 'student', passwordHash: randomBytes(32).toString('hex') } });
        return { userId: account.id, role: 'student' as const };
      }));
      await prisma.projectMember.createMany({ data: peers.map(actor => ({ projectId: project.id, userId: actor.userId, roleOverride: 'viewer' })) });
      const baseline = await discussion.send(project.id, owner, randomUUID(), 'Send barrier baseline');
      const server = Fastify(), controlledWake = new ControlledProjectWakeSource(), store = new LocalRealtimeSocketLeaseStore();
      const droppedUsers = new Set<string>(), sockets = new Set<WebSocket>(), warmed = new Set<string>();
      let armed = false, release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      const heldCohorts: string[][] = [];
      const leases = new RealtimeSocketLeases({ acquire: (lease, ttl) => store.acquire(lease, ttl),
        renew: (held, ttl) => store.renew(held.filter(lease => !droppedUsers.has(lease.userId)), ttl), release: lease => store.release(lease) },
      () => randomBytes(16).toString('hex'), { ttlMs: 1000, renewEveryMs: 50, sweepMs: 10 });
      registerProjectRealtime(server, tickets, {
        events: discussion.events.bind(discussion),
        eventsBatch: async (id, actors, since, limit) => {
          const result = await discussion.eventsBatch(id, actors, since, limit);
          if (armed) { heldCohorts.push(actors.map(actor => actor.userId)); await gate; }
          else for (const actor of actors) warmed.add(actor.userId);
          return result;
        },
      }, ['http://collaboration.test'], leases, controlledWake);
      try {
        await server.listen({ host: '127.0.0.1', port: 0 });
        const location = server.server.address(); assert(location && typeof location !== 'string');
        const selected = [owner, ...peers];
        const issued = await Promise.all(selected.map(actor => tickets.create({ projectId: project.id, actor, jti: randomUUID(), expiresAt: Date.now() + 60_000 })));
        const clients = await Promise.all(issued.map(ticket => connectRealtime(`ws://127.0.0.1:${location.port}/api/v1/projects/${project.id}/realtime`, ticket.ticket, baseline.message.seq, sockets)));
        await waitUntil(() => warmed.size === selected.length);
        await new Promise(resolve => setTimeout(resolve, 100));
        armed = true;
        const sent = await discussion.send(project.id, owner, randomUUID(), 'Only the valid peer receives this commit');
        controlledWake.wake(project.id);
        await waitUntil(() => heldCohorts.some(cohort => selected.every(actor => cohort.includes(actor.userId))));
        const member = await prisma.projectMember.findUniqueOrThrow({ where: { projectId_userId: { projectId: project.id, userId: peers[0].userId } } });
        await sharing.changeMember(project.id, member.id, owner, {}, true);
        clients[3].socket.terminate();
        droppedUsers.add(peers[1].userId);
        await waitUntil(() => clients[2].closeCode() === 1013 && clients[3].closeCode() !== undefined);
        release();
        await waitUntil(() => clients[0].sequences().includes(sent.message.seq) && clients[1].closeCode() === 4403);
        assert.deepEqual(clients[0].sequences(), [sent.message.seq]);
        for (const client of clients.slice(1)) assert.deepEqual(client.sequences(), [], 'A page read before a guard changed must not be sent afterwards');
      } finally { release(); for (const socket of sockets) socket.terminate(); await server.close(); }
    });
    await t.test('realtime policy server-cancels locked reads, drains later batches and restores pooled statement timeout', { timeout: 20_000 }, async () => {
      const project = await prisma.project.create({ data: { title: 'Policy SQL deadline fixture', category: 'other', ownerId: owner.userId } });
      const fixture = policyTimeoutFixture(schema, admin), pending: Promise<unknown>[] = [];
      const session = { projectId: project.id, actor: owner, jti: randomUUID(), expiresAt: Date.now() + 60_000 };
      const outcomes: Array<PromiseSettledResult<boolean> | undefined> = [];
      const observe = (index: number) => {
        const completion = fixture.policy.validate({ ...session, jti: randomUUID() }).then(
          value => { outcomes[index] = { status: 'fulfilled', value }; },
          reason => { outcomes[index] = { status: 'rejected', reason }; });
        pending.push(completion);
      };
      try {
        const initial = (await fixture.settings())[0]; assert.equal(initial.timeout, '7s');
        await fixture.lock(); assert.equal(await fixture.isHeld(), true);
        const started = performance.now(); observe(0);
        const firstWait = await waitForDatabase(() => fixture.waiting(), rows => rows.length === 1);
        observe(1); // This check must queue behind the running transaction, then obtain a fresh bounded transaction.
        await waitUntil(() => outcomes[0] !== undefined, 3500);
        const first = outcomes[0]!; assert.equal(first.status, 'rejected');
        if (first.status === 'rejected') assert.match(String(first.reason), /57014|statement timeout/i);
        assert(performance.now() - started < 3500, 'The SQL deadline must cancel work before the four-second transaction deadline');
        await waitForDatabase(() => fixture.waiting(), rows => rows.some(row => row.queryStartedAt !== firstWait[0].queryStartedAt));
        await waitUntil(() => outcomes[1] !== undefined, 3500);
        const second = outcomes[1]!; assert.equal(second.status, 'rejected');
        if (second.status === 'rejected') assert.match(String(second.reason), /57014|statement timeout/i);
        assert.equal(await fixture.isHeld(), true, 'Cancellation must happen while the conflicting lock still exists');
        assert.deepEqual(await fixture.waiting(), [], 'Timed-out SQL must disappear on the PostgreSQL server');
        assert.equal(await fixture.activeWork(), 0, 'A settled failure must not leave an active or aborted transaction behind');
        const afterFailure = (await fixture.settings())[0]; assert.equal(afterFailure.timeout, initial.timeout);
        await fixture.unlock();
        assert.deepEqual(await Promise.all([
          fixture.policy.validate(session),
          fixture.policy.validate({ ...session, actor: { ...actors.outsider, role: 'admin' } }),
          fixture.policy.validate({ ...session, actor: actors.admin }),
        ]), [true, false, false], 'The recovered scheduler must preserve persisted-role and discussion access policy');
        // A present invalid-token record remains authoritative even if its cleanup deadline is old.
        await prisma.invalidToken.create({ data: { jti: session.jti, userId: owner.userId, expiresAt: new Date(0) } });
        assert.equal(await fixture.policy.validate(session), false);
        const afterSuccess = (await fixture.settings())[0]; assert.equal(afterSuccess.timeout, initial.timeout);
        assert.equal(await fixture.activeWork(), 0);
        t.diagnostic(`Policy SQL cancellation: two queued batches rejected with PostgreSQL statement timeout; pool setting ${initial.timeout} restored; physical connection reused=${initial.pid === afterSuccess.pid}`);
      } finally { await fixture.close(pending); }
    });
    await t.test('a native cohort releases its page after real policy SQL timeout and reconnects after lock recovery', { timeout: 20_000 }, async () => {
      const project = await prisma.project.create({ data: { title: 'Native policy SQL deadline fixture', category: 'other', ownerId: owner.userId } });
      const account = await prisma.user.create({ data: { email: 'policy-timeout-peer@example.invalid', role: 'student', passwordHash: randomBytes(32).toString('hex') } });
      const peer: ProjectActor = { userId: account.id, role: 'student' };
      await prisma.projectMember.create({ data: { projectId: project.id, userId: peer.userId, roleOverride: 'viewer' } });
      const baseline = await discussion.send(project.id, owner, randomUUID(), 'Policy timeout baseline');
      const fixture = policyTimeoutFixture(schema, admin);
      const boundedTickets = new RealtimeTickets(new ShareTokenCrypto(), fixture.policy, new LocalRealtimeTicketStore());
      const server = Fastify(), controlledWake = new ControlledProjectWakeSource(), metrics = new ServiceMetrics();
      const sockets = new Set<WebSocket>(), warmed = new Set<string>();
      let armed = false, held = false, release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      server.decorate('serviceMetrics', metrics);
      registerProjectRealtime(server, { consume: boundedTickets.consume.bind(boundedTickets), validate: async session => {
        const result = await boundedTickets.validate(session);
        if (!armed) warmed.add(session.actor.userId);
        return result;
      } }, { events: discussion.events.bind(discussion), eventsBatch: async (...args) => {
        const result = await discussion.eventsBatch(...args);
        if (armed) { assert.equal(args[1].length, 2); held = true; await gate; }
        return result;
      } }, ['http://collaboration.test'],
      new RealtimeSocketLeases(new LocalRealtimeSocketLeaseStore(), () => randomBytes(16).toString('hex')), controlledWake);
      try {
        const initial = (await fixture.settings())[0]; assert.equal(initial.timeout, '7s');
        await server.listen({ host: '127.0.0.1', port: 0 });
        const address = server.server.address(); assert(address && typeof address !== 'string');
        const url = `ws://127.0.0.1:${address.port}/api/v1/projects/${project.id}/realtime`;
        const issued = await Promise.all([owner, peer].map(actor => boundedTickets.create({ projectId: project.id, actor,
          jti: randomUUID(), expiresAt: Date.now() + 60_000 })));
        const clients = await Promise.all(issued.map(ticket => connectRealtime(url, ticket.ticket, baseline.message.seq, sockets)));
        await waitUntil(() => warmed.size === 2);
        armed = true;
        const committed = await discussion.send(project.id, owner, randomUUID(), 'Recovered native policy commit');
        controlledWake.wake(project.id); await waitUntil(() => held);
        // Access facts and payload already came from a real committed snapshot. Only the post-read primary policy is blocked.
        await fixture.lock(); release();
        await waitForDatabase(() => fixture.waiting(), rows => rows.length === 1);
        await waitUntil(() => clients.every(client => client.closeCode() === 4403), 3500);
        for (const client of clients) assert.deepEqual(client.sequences(), [], 'A failed session recheck must not publish the earlier snapshot');
        await waitForDatabase(() => metrics.registry.metrics(), snapshot =>
          /tlu_realtime_state\{state="activeReplays"\} 0\b/.test(snapshot) &&
          /tlu_realtime_state\{state="activeReplayRecipients"\} 0\b/.test(snapshot));
        assert.equal(await fixture.isHeld(), true, 'The cohort must release its page before the test removes the database lock');
        // A periodic authorization check may have queued another bounded batch; releasing the lock lets every remaining check settle.
        await fixture.unlock(); armed = false;
        const recovered = await boundedTickets.create({ projectId: project.id, actor: owner, jti: randomUUID(), expiresAt: Date.now() + 60_000 });
        const client = await connectRealtime(url, recovered.ticket, baseline.message.seq, sockets);
        await waitUntil(() => client.sequences().includes(committed.message.seq));
        assert.deepEqual(client.sequences(), [committed.message.seq]);
        assert.equal((await fixture.settings())[0].timeout, initial.timeout);
        t.diagnostic('Native policy SQL timeout closed both recipients, released active cohort/recipient counts while locked, and replayed the committed event after recovery');
      } finally {
        release(); await fixture.unlock().catch(() => {});
        for (const socket of sockets) socket.terminate();
        try { await server.close(); }
        finally { metrics.close(); await fixture.close(); }
      }
    });
    await t.test('committed events reach multiple sockets below one second, drain over 100 events, and idle sockets do not poll replay every two seconds', async () => {
      const head = (await prisma.projectCollaborationState.findUniqueOrThrow({ where: { projectId: p.id } })).lastEventSeq.toString();
      const clients = await Promise.all([owner, viewer, commenter].map(async actor => {
        const ticket = await tickets.create({ projectId: p.id, actor, jti: randomUUID(), expiresAt: Date.now() + 60_000 });
        const ws = new WebSocket(wsUrl, { origin: 'http://collaboration.test' });
        const frames: { type: string; events?: { seq: string; payload?: unknown }[]; nextCursor?: string }[] = [];
        ws.on('message', data => frames.push(JSON.parse(data.toString())));
        await new Promise<void>((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
        ws.send(JSON.stringify({ type: 'authenticate', ticket: ticket.ticket, since: head }));
        await waitUntil(() => frames.some(frame => frame.type === 'ready'));
        return { ws, frames };
      }));
      try {
        const latencies: number[] = [];
        for (let i = 0; i < 5; i++) {
          const sent = await discussion.send(p.id, owner, randomUUID(), `Latency sample ${i}`), committedAt = performance.now();
          await waitUntil(() => clients.every(client => client.frames.some(frame => frame.events?.some(event => event.seq === sent.message.seq))), 950);
          latencies.push(performance.now() - committedAt);
        }
        const readsBeforeBurst = eventReads;
        const finalSeq = await discussionRepo.run(p.id, owner, async tx => {
          let last = '';
          for (let i = 0; i < 125; i++) last = (await tx.send(randomUUID(), `Burst ${i}`)).seq;
          return last;
        });
        const burstCommittedAt = performance.now();
        await waitUntil(() => clients.every(client => client.frames.some(frame => frame.events?.some(event => event.seq === finalSeq))), 950);
        const burstMs = performance.now() - burstCommittedAt;
        assert(burstMs < 1000);
        const burstReads = eventReads - readsBeforeBurst;
        assert(burstReads <= clients.length * 3, `Expected batched page replay, saw ${burstReads} event reads`);
        // Align just after the global fallback interval to avoid racing its legitimate catch-up.
        await wakeSource.stop();
        const missed = await discussion.send(p.id, owner, randomUUID(), 'Fallback repairs a missed notification');
        await waitUntil(() => clients.every(client => client.frames.some(frame => frame.events?.some(event => event.seq === missed.message.seq))), 11_000);
        await wakeSource.start();
        const readsBeforeIdle = replayHeadReads, eventsBeforeIdle = eventReads;
        await new Promise(resolve => setTimeout(resolve, 2300));
        assert.equal(replayHeadReads, readsBeforeIdle, 'Access checks must not read event heads during idle two-second periods');
        assert.equal(eventReads, eventsBeforeIdle, 'Access checks must not scan event rows during idle two-second periods');
        t.diagnostic(`Local PostgreSQL + ${clients.length} native sockets: five commits max ${Math.max(...latencies).toFixed(1)}ms; 125-event burst ${burstMs.toFixed(1)}ms; burst replay queries ${burstReads}.`);
      } finally { for (const client of clients) client.ws.terminate(); }
    });
    await t.test('multi-link max role, owner override, rotation, block and explicit rejoin', async () => {
      await sharing.receive(viewer, links.editor.link.id, links.editor.token, true);
      assert.equal((await sharing.access(p.id, viewer)).level, 'editor');
      const member = await prisma.projectMember.findUniqueOrThrow({ where: { projectId_userId: { projectId: p.id, userId: viewer.userId } } });
      await sharing.changeMember(p.id, member.id, owner, { roleOverride: 'viewer' });
      assert.equal((await sharing.access(p.id, viewer)).level, 'viewer');
      const rotated = await sharing.update(p.id, links.viewer.link.id, owner, { baseVersion: 1 }, true);
      await assert.rejects(sharing.receive(viewer, links.viewer.link.id, links.viewer.token, true));
      assert.equal((await sharing.access(p.id, viewer)).level, 'viewer');
      await sharing.changeMember(p.id, member.id, owner, {}, true);
      await assert.rejects(sharing.receive(viewer, links.editor.link.id, links.editor.token, true));
      await sharing.changeMember(p.id, member.id, owner, { status: 'active' });
      await assert.rejects(sharing.access(p.id, viewer));
      await sharing.receive(viewer, rotated.link.id, rotated.token!, true);
      await sharing.leave(p.id, viewer); await assert.rejects(sharing.access(p.id, viewer));
      await sharing.receive(viewer, rotated.link.id, rotated.token!, true);
    });
    await t.test('bibliography concurrent imports merge without lost updates and recheck write permission', async () => {
      const bib = new BibliographyService(fileRepo);
      const entries = [{ key: 'first', type: 'article' as const, fields: { title: 'First' } }, { key: 'second', type: 'article' as const, fields: { title: 'Second' } }];
      await Promise.all(entries.map(entry => bib.writeBibFile(p.id, 'refs.bib', [entry], editor.userId, [entry])));
      assert.equal((await bib.readBibFile(p.id, 'refs.bib')).length, 2);
      await assert.rejects(bib.writeBibFile(p.id, 'refs.bib', entries, viewer.userId));
    });
    await t.test('binary upload staged before revocation cannot finalize and cleans up the staged blob', async () => {
      const link = await sharing.create(p.id, owner, { role: 'editor', expiresAt: null });
      await sharing.receive(actors.outsider, link.link.id, link.token, true);
      let release!: () => void, entered!: () => void, cleaned = false;
      const gate = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
      const storage: BlobStorage = { put: async () => { entered(); await gate; return { sizeBytes: 10, sha256: '', contentType: 'application/pdf' }; },
        get: async () => Readable.from([]), head: async () => null, delete: async () => { cleaned = true; } };
      const upload = new UploadBinaryFileUseCase(fileRepo, storage, new PrismaProjectAccessRepository(prisma));
      const pending = upload.execute({ projectId: p.id, userId: actors.outsider.userId, path: 'staged.pdf', stream: Readable.from('%PDF-1.4\n'), declaredMimeType: 'application/pdf' });
      const rejected = assert.rejects(pending);
      await started; await sharing.revoke(p.id, link.link.id, owner); release(); await rejected;
      assert.equal(cleaned, true); assert.equal(await fileRepo.exists(p.id, 'staged.pdf'), false);
    });
    await t.test('links, members and comment reply pagination has stable cursors; concurrent link creation respects the cap', async () => {
      const first = await call('owner', 'GET', `/projects/${p.id}/share-links?limit=1`); assert.equal(first.json().links.length, 1);
      const next = await call('owner', 'GET', `/projects/${p.id}/share-links?limit=1&before=${first.json().nextCursor}`);
      assert.notEqual(first.json().links[0].id, next.json().links[0].id);
      const m = (await call('owner', 'GET', `/projects/${p.id}/members?limit=1`)).json();
      assert.equal(m.members.length, 1); assert(m.nextCursor);
      const thread = (await discussion.threads(p.id, owner)).threads[0];
      const comments = await discussion.comments(p.id, owner, thread.id, undefined, 1);
      assert.equal(comments.comments.length, 1);
      const reply = await discussion.comments(p.id, owner, thread.id, comments.nextCursor!, 1);
      assert.equal(reply.comments.length, 1); assert.notEqual(reply.comments[0].id, comments.comments[0].id);
      const results = await Promise.allSettled(Array.from({ length: 21 }, () => sharing.create(other.id, owner, { role: 'viewer', expiresAt: null })));
      assert(results.some(r => r.status === 'rejected'));
      assert.equal(await prisma.projectShareLink.count({ where: { projectId: other.id, revokedAt: null } }), 20);
    });
    await t.test('WebSocket origin and one-use tickets; project-scoped replay and revocation under five seconds', async () => {
      const rejected = new WebSocket(wsUrl, { origin: 'http://wrong.test' });
      await new Promise<void>(resolve => { rejected.on('error', () => resolve()); });
      const claims = app.jwt.decode<{ jti: string }>(tokens.viewer); assert(claims);
      const ticket = await tickets.create({ projectId: p.id, actor: viewer, jti: claims.jti, expiresAt: Date.now() + 60_000 });
      const ws = new WebSocket(wsUrl, { origin: 'http://collaboration.test' }); const frames: unknown[] = [];
      ws.on('message', data => frames.push(JSON.parse(data.toString())));
      await new Promise<void>((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
      ws.send(JSON.stringify({ type: 'authenticate', ticket: ticket.ticket, since: '0' }));
      const waitUntil = async (condition: () => boolean) => { const deadline = Date.now() + 5000; while (!condition() && Date.now() < deadline) await new Promise(r => setTimeout(r, 30)); assert(condition()); };
      await waitUntil(() => frames.some(f => (f as { type: string }).type === 'events'));
      assert(!JSON.stringify(frames).includes('<script>'));
      await assert.rejects(tickets.consume(p.id, ticket.ticket));
      const started = Date.now(); const closed = new Promise<number>(resolve => ws.once('close', code => resolve(code)));
      await sharing.revoke(p.id, links.viewer.link.id, owner);
      assert.equal(await closed, 4403); assert(Date.now() - started < 5000);
      await assert.rejects(discussion.send(p.id, viewer, randomUUID(), 'revoked'));
    });
    await t.test('wrong-project/expired tickets fail, a revoked session closes, and unauthenticated sockets receive no events', async () => {
      const jti = randomUUID(), session = { projectId: p.id, actor: owner, jti, expiresAt: Date.now() + 60_000 };
      const wrong = await tickets.create(session); await assert.rejects(tickets.consume(other.id, wrong.ticket)); await assert.rejects(tickets.consume(p.id, wrong.ticket));
      const expiring = await tickets.create({ ...session, expiresAt: Date.now() + 200 });
      await new Promise(r => setTimeout(r, 250)); await assert.rejects(tickets.consume(p.id, expiring.ticket));
      const active = await tickets.create(session), ws = new WebSocket(wsUrl, { origin: 'http://collaboration.test' });
      let ready!: () => void; const authenticated = new Promise<void>(resolve => { ready = resolve; });
      ws.on('message', data => { if (JSON.parse(data.toString()).type === 'ready') ready(); });
      await new Promise<void>((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
      ws.send(JSON.stringify({ type: 'authenticate', ticket: active.ticket, since: '0' })); await authenticated;
      const closed = new Promise<number>(resolve => ws.once('close', code => resolve(code))), start = Date.now();
      await prisma.invalidToken.create({ data: { jti, userId: owner.userId, expiresAt: new Date(session.expiresAt) } });
      assert.equal(await closed, 4403); assert(Date.now() - start < 5000);
      const anonymous = new WebSocket(wsUrl, { origin: 'http://collaboration.test' }); let received = 0;
      anonymous.on('message', () => { received++; }); const timedOut = new Promise<number>(resolve => anonymous.once('close', code => resolve(code)));
      assert.equal(await timedOut, 4401); assert.equal(received, 0);
    });
    await t.test('inactive account and expired/revoked links fail immediately; admin oversight stays out of discussion', async () => {
      await prisma.user.update({ where: { id: editor.userId }, data: { isActive: false } });
      await assert.rejects(discussion.history(p.id, editor));
      const expired = await sharing.create(p.id, owner, { role: 'viewer', expiresAt: new Date(Date.now() + 60_000).toISOString() });
      await prisma.projectShareLink.update({ where: { id: expired.link.id }, data: { expiresAt: new Date(0) } });
      await assert.rejects(sharing.receive(actors.outsider, expired.link.id, expired.token, true));
      await assert.rejects(discussion.history(p.id, actors.admin));
      const ghost = await prisma.user.create({ data: { email: 'deleted@example.invalid', role: 'student', passwordHash: randomBytes(32).toString('hex') } });
      await sharing.receive({ userId: ghost.id, role: 'student' }, links.commenter.link.id, links.commenter.token, true);
      const sent = await discussion.send(p.id, { userId: ghost.id, role: 'student' }, randomUUID(), 'Retained history');
      await prisma.user.delete({ where: { id: ghost.id } });
      const saved = (await discussion.history(p.id, owner)).messages.find(m => m.id === sent.message.id)!;
      assert.equal(saved.author.id, null); assert.equal(saved.author.displayName, 'Người dùng đã xóa');
    });
    await t.test('message ordering/pagination remains exact beyond Number.MAX_SAFE_INTEGER; project deletion cascades discussion', async () => {
      for (const cursor of ['invalid', '-1', '1e3', '01', '9223372036854775808']) {
        const invalid = await call('owner', 'GET', `/projects/${p.id}/events?since=${cursor}`);
        assert.equal(invalid.statusCode, 400, invalid.body);
        assert.equal((await call('owner', 'PUT', `/projects/${p.id}/chat/read-state`, { lastReadMessageSeq: cursor })).statusCode, 400);
      }
      await prisma.projectCollaborationState.update({ where: { projectId: p.id }, data: { lastEventSeq: 9007199254740993n } });
      const sent = await Promise.all([0, 1, 2].map(i => discussion.send(p.id, owner, randomUUID(), `Big ${i}`)));
      assert.equal(new Set(sent.map(s => s.message.seq)).size, 3);
      const page = await discussion.history(p.id, owner, undefined, 2); assert.equal(page.messages.length, 2);
      assert(BigInt(page.messages[0].seq) > BigInt(page.messages[1].seq));
      const next = await discussion.history(p.id, owner, page.nextCursor!, 2); assert(!next.messages.some(m => page.messages.some(p => p.id === m.id)));
      await projectRepo.delete(p.id);
      assert.equal(await prisma.projectChatMessage.count({ where: { projectId: p.id } }), 0);
      assert.equal(await prisma.projectCommentThread.count({ where: { projectId: p.id } }), 0);
    });
    await t.test('all 28 documented collaboration operations match real HTTP JSON on PostgreSQL', async () => {
      const contractProject = await prisma.project.create({ data: { title: 'HTTP contract fixture', category: 'other', ownerId: owner.userId } });
      const path = `/projects/${contractProject.id}`;
      const request = async (who: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, status: number, body?: unknown) => {
        const result = await call(who, method, url, body); assert.equal(result.statusCode, status, `${method} ${url}`);
        return status === 204 ? undefined : result.json();
      };
      const created = await request('owner', 'POST', `${path}/share-links`, 201, { role: 'commenter', expiresAt: null });
      const invitation = { linkId: created.link.id, token: created.shareUrl.split('#token=')[1] };
      await request('viewer', 'POST', '/project-shares/resolve', 200, invitation);
      await request('viewer', 'POST', '/project-shares/redeem', 200, invitation);
      await request('viewer', 'GET', '/projects/shared', 200);
      await request('viewer', 'GET', `${path}/access`, 200);
      await request('owner', 'GET', `${path}/share-links`, 200);
      const members = await request('owner', 'GET', `${path}/members`, 200);
      const memberId = members.members.find((member: { userId: string }) => member.userId === viewer.userId).id;
      await request('owner', 'PATCH', `${path}/members/${memberId}`, 200, { roleOverride: 'editor' });
      const updated = await request('owner', 'PATCH', `${path}/share-links/${created.link.id}`, 200, { baseVersion: created.link.version, label: 'Contract link' });
      await request('owner', 'POST', `${path}/share-links/${created.link.id}/rotate`, 200, { baseVersion: updated.link.version });
      const chatBody = { clientMessageId: randomUUID(), body: 'HTTP contract message' };
      const sent = await request('viewer', 'POST', `${path}/chat/messages`, 201, chatBody);
      await request('viewer', 'POST', `${path}/chat/messages`, 200, chatBody);
      await request('viewer', 'GET', `${path}/chat/messages`, 200);
      await request('viewer', 'GET', `${path}/chat/read-state`, 200);
      await request('viewer', 'PUT', `${path}/chat/read-state`, 200, { lastReadMessageSeq: sent.message.seq });
      await request('viewer', 'DELETE', `${path}/chat/messages/${sent.message.id}`, 204);
      const made = await request('viewer', 'POST', `${path}/comments/threads`, 201, { clientCommentId: randomUUID(), body: 'HTTP contract comment', anchor: { kind: 'project' } });
      const threadPath = `${path}/comments/threads/${made.thread.id}`;
      const reply = await request('viewer', 'POST', `${threadPath}/replies`, 201, { clientCommentId: randomUUID(), body: 'Reply' });
      await request('viewer', 'GET', `${threadPath}/replies`, 200);
      const edited = await request('viewer', 'PATCH', `${path}/comments/${reply.comment.id}`, 200, { baseRevision: reply.comment.revision, body: 'Edited reply' });
      await request('viewer', 'DELETE', `${path}/comments/${reply.comment.id}`, 200, { baseRevision: edited.comment.revision });
      const current = await request('viewer', 'GET', `${path}/comments/threads`, 200);
      const resolved = await request('viewer', 'PATCH', threadPath, 200, { baseRevision: current.threads[0].revision, state: 'resolved' });
      await request('viewer', 'DELETE', threadPath, 200, { baseRevision: resolved.thread.revision });
      await request('viewer', 'GET', `${path}/events`, 200);
      await request('viewer', 'POST', `${path}/realtime-ticket`, 200);
      await request('viewer', 'POST', `${path}/leave`, 204);
      await request('owner', 'DELETE', `${path}/members/${memberId}`, 204);
      await request('owner', 'DELETE', `${path}/share-links/${created.link.id}`, 204);
      assert.deepEqual(contractFailures, []);
      assert.equal(successfulOperations.size, 28);
      assert(contractResponses >= 50);
      t.diagnostic(`OpenAPI validated ${contractResponses} actual HTTP responses, ${successfulOperations.size} operations`);
    });
    await t.test('an editor duplicate cannot expose owner private settings; owner copy preserves them and source remains unchanged', async () => {
      // Earlier revocation tests intentionally leave the original editor account ineligible.
      const account = await prisma.user.create({ data: { email: 'duplicate-editor@example.invalid', role: 'student', passwordHash: randomBytes(32).toString('hex') } });
      const duplicateEditor = { userId: account.id, role: 'student' as const };
      actors.duplicateEditor = duplicateEditor;
      tokens.duplicateEditor = app.jwt.sign({ sub: account.id, jti: randomUUID(), role: 'student', email: account.email }, { expiresIn: '15m' });
      const source = await projectRepo.create({ title: 'Private settings fixture', category: TemplateCategory.Other, ownerId: owner.userId });
      await fileRepo.create({ actorId: owner.userId, projectId: source.id, path: 'main.typ', kind: FileKind.Typst,
        content: '= Fixture', storageMode: 'inline', sizeBytes: 9, sha256: 'fixture-only' });
      await containers.getSettingsRepo().findOrCreate(source.id);
      await prisma.projectSettings.update({ where: { projectId: source.id }, data: { compileOptions: { ppi: 144 },
        zoteroConfig: { apiKey: 'fixture-owner-only', libraryId: 'fixture-library' }, openalexConfig: { email: 'owner@example.invalid' } } });
      const original = await prisma.projectSettings.findUniqueOrThrow({ where: { projectId: source.id } });
      const link = await sharing.create(source.id, owner, { role: 'editor', expiresAt: null });
      await sharing.receive(duplicateEditor, link.link.id, link.token, true);
      const storage: BlobStorage = { put: async () => { throw new Error('Unexpected binary write'); },
        get: async () => { throw new Error('Unexpected binary read'); }, head: async () => null, delete: async () => {} };
      const policy = new PrismaProjectAccessRepository(prisma);
      containers.wireZipPortability(storage, { requireProjectAccess: (id, userId) => policy.requireExportAccess(id, userId) });
      for (const label of ['owner', 'duplicateEditor']) {
        const created = await call(label, 'POST', `/projects/${source.id}/duplicate`, {});
        assert.equal(created.statusCode, 201, created.body);
        assert.equal(created.json().ownerId, actors[label].userId);
        const copyId = created.json().id as string;
        const read = await call(label, 'GET', `/projects/${copyId}/settings`); assert.equal(read.statusCode, 200, read.body);
        const copy = read.json().settings;
        const persisted = await prisma.projectSettings.findUniqueOrThrow({ where: { projectId: copyId } });
        assert.equal(copy.mainPath, 'main.typ'); assert.deepEqual(persisted.compileOptions, { ppi: 144 });
        if (label === 'duplicateEditor') {
          assert.equal(copy.zoteroConfig, null); assert.equal(copy.openalexConfig, null);
          assert.equal(persisted.zoteroConfig, null); assert.equal(persisted.openalexConfig, null);
        } else {
          assert.deepEqual(persisted.zoteroConfig, original.zoteroConfig); assert.deepEqual(persisted.openalexConfig, original.openalexConfig);
          assert.deepEqual(copy.zoteroConfig, original.zoteroConfig); assert.deepEqual(copy.openalexConfig, original.openalexConfig);
        }
        assert.equal(await prisma.file.count({ where: { projectId: copyId } }), 1);
      }
      assert.deepEqual(await prisma.projectSettings.findUniqueOrThrow({ where: { projectId: source.id } }), original);
    });
  } finally {
    await app.close(); await prisma.$disconnect(); await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await admin.end();
  }
});
