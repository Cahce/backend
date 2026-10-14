import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import Fastify from 'fastify';
import type { AppConfig } from '../../../../../config/index.js';
import type { AuthUser } from '../../../domain/Ports.js';
import { PasswordHasherBcrypt } from '../../../infra/PasswordHasherBcrypt.js';
import { authRoutes } from '../Routes.js';
import { jwtPlugin } from '../../../../../plugins/JWT.js';
import { toErrorResponse } from '../../../../../shared/http/domainError.js';
import { RequestRateLimit } from '../../../../../shared/rate-limit/RequestRateLimit.js';
import { LocalRateLimitStore } from '../../../../../shared/rate-limit/LocalRateLimitStore.js';
import { ServiceMetrics } from '../../../../../shared/observability/ServiceMetrics.js';

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    return { promise, resolve };
}
async function until(condition: () => boolean | Promise<boolean>) {
    const deadline = Date.now() + 2000;
    while (!(await condition())) {
        if (Date.now() > deadline) assert.fail('condition did not become true');
        await delay(5);
    }
}
async function makeApp(options: {
    read?: () => Promise<AuthUser | null>; concurrency?: number; capacity?: number; waitMs?: number;
    rate?: RequestRateLimit; ipRate?: number; pairRate?: number; passwordRate?: number; revoked?: () => boolean;
} = {}) {
    let reads = 0, writes = 0;
    const app = Fastify();
    const metrics = new ServiceMetrics();
    const rate = options.rate ?? new RequestRateLimit();
    app.decorate('serviceMetrics', metrics);
    app.decorate('requestRateLimit', rate);
    app.decorate('config', { auth: { jwtSecret: randomBytes(32).toString('hex'), accessTtl: '15m', refreshTtl: '1d',
        passwordWork: { concurrency: options.concurrency ?? 1, maxOutstanding: options.capacity ?? 2, queueWaitMs: options.waitMs ?? 1000 },
        loginIpPerMinute: options.ipRate ?? 12000, loginPairPerMinute: options.pairRate ?? 2, changePasswordPerMinute: options.passwordRate ?? 1,
    } } as AppConfig);
    app.decorate('prisma', {
        user: { async findUnique() { reads++; return options.read ? options.read() : null; } },
        refreshToken: { async create() { writes++; return { id: 'refresh-row' }; } },
    } as unknown as typeof app.prisma);
    app.setErrorHandler((error, _request, reply) => {
        if ((error as { validation?: unknown }).validation) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid body' } });
        const mapped = toErrorResponse(error);
        if (mapped.retryAfterSeconds) reply.header('Retry-After', String(mapped.retryAfterSeconds));
        return reply.code(mapped.status).send(mapped.body);
    });
    await app.register(jwtPlugin, { sessionReader: { async readMany(inputs) { return inputs.map(input => ({
        userId: input.userId, role: 'student' as const, isActive: true, mustChangePassword: false, revoked: options.revoked?.() ?? false,
    })); } } });
    await app.register(authRoutes, { prefix: '/api/v1/auth' });
    app.addHook('onClose', async () => metrics.close());
    await app.ready();
    return { app, metrics, rate, counts: () => ({ reads, writes }) };
}
const login = (email = 'user@e.tlu.edu.vn') => ({ method: 'POST' as const, url: '/api/v1/auth/login',
    payload: { email, password: randomBytes(12).toString('hex') } });

test('real auth route rejects malformed input before DB; normalized pair quota resists XFF spoof without blocking other NAT users', async () => {
    const { app, counts } = await makeApp();
    try {
        assert.equal((await app.inject({ ...login(), payload: { email: 'not-email' } })).statusCode, 400);
        assert.equal(counts().reads, 0);
        assert.equal((await app.inject(login())).statusCode, 401);
        assert.equal((await app.inject({ ...login('USER@E.TLU.EDU.VN'), headers: { 'x-forwarded-for': '192.0.2.9' } })).statusCode, 401);
        const limited = await app.inject({ ...login(), headers: { 'x-forwarded-for': '192.0.2.10' } });
        assert.equal(limited.statusCode, 429); assert.equal(limited.json().error.code, 'RATE_LIMITED');
        assert.ok(Number(limited.headers['retry-after']) > 0);
        assert.equal(counts().reads, 2);
        assert.equal((await app.inject(login('other@e.tlu.edu.vn'))).statusCode, 401);
        assert.equal(counts().reads, 3);
    } finally { await app.close(); }
});

test('login quota is shared between two route instances using the injected store', async () => {
    const store = new LocalRateLimitStore();
    const a = await makeApp({ rate: new RequestRateLimit(store) }), b = await makeApp({ rate: new RequestRateLimit(store) });
    try {
        assert.equal((await a.app.inject(login())).statusCode, 401);
        assert.equal((await b.app.inject(login())).statusCode, 401);
        assert.equal((await a.app.inject(login())).statusCode, 429);
        assert.equal(a.counts().reads + b.counts().reads, 2);
    } finally { await Promise.all([a.app.close(), b.app.close()]); }
});

test('IP quota applies before parsing, and unavailable shared limiter rejects before DB', async () => {
    const first = await makeApp({ ipRate: 1 });
    try {
        assert.equal((await first.app.inject({ ...login(), payload: {} })).statusCode, 400);
        assert.equal((await first.app.inject(login())).statusCode, 429);
        assert.equal(first.counts().reads, 0);
    } finally { await first.app.close(); }
    const offline = await makeApp({ rate: new RequestRateLimit({ async take() { throw new Error('offline'); } }) });
    try {
        const response = await offline.app.inject(login());
        assert.equal(response.statusCode, 503);
        assert.equal(response.headers['retry-after'], '1');
        assert.equal(response.json().error.code, 'RATE_LIMIT_UNAVAILABLE');
        assert.equal(offline.counts().reads, 0);
    } finally { await offline.app.close(); }
});

test('full/expired auth queue returns retryable 503 without extra DB work; held slot and metrics recover', async () => {
    const pending = deferred();
    const { app, counts, metrics } = await makeApp({ read: async () => { await pending.promise; return null; }, waitMs: 500 });
    try {
        const first = app.inject(login('first@e.tlu.edu.vn'));
        await until(() => counts().reads === 1);
        const second = app.inject(login('second@e.tlu.edu.vn'));
        await until(async () => (await metrics.registry.metrics()).includes('tlu_auth_password_work{state="queued"} 1'));
        const third = await app.inject(login('third@e.tlu.edu.vn'));
        assert.equal(third.statusCode, 503); assert.equal(third.json().error.code, 'AUTH_BUSY');
        assert.equal(third.headers['retry-after'], '1');
        assert.equal((await second).json().error.code, 'AUTH_BUSY');
        assert.equal(counts().reads, 1);
        assert.match(await metrics.registry.metrics(), /tlu_auth_password_work\{state="running"\} 1/);
        pending.resolve(); assert.equal((await first).statusCode, 401);
        assert.match(await metrics.registry.metrics(), /tlu_auth_password_duration_seconds_count\{phase="execution"\} 1/);
        assert.match(await metrics.registry.metrics(), /tlu_auth_password_duration_seconds_count\{phase="queue"\} 1/);
        assert.match(await metrics.registry.metrics(), /tlu_auth_password_expired_total 1/);
        assert.match(await metrics.registry.metrics(), /tlu_auth_password_work\{state="running"\} 0/);
        assert.equal((await app.inject(login('next@e.tlu.edu.vn'))).statusCode, 401);
    } finally { pending.resolve(); await app.close(); }
});

test('change-password authenticates before account quota and retains business error shape', async () => {
    const { app, rate, counts } = await makeApp();
    try {
        const payload = { oldPassword: randomBytes(12).toString('hex'), newPassword: 'new', confirmNewPassword: 'new' };
        const request = { method: 'POST' as const, url: '/api/v1/auth/change-password', payload };
        assert.equal((await app.inject(request)).statusCode, 401);
        assert.equal(rate.snapshot().checks, 0);
        const token = app.jwt.sign({ sub: 'u', jti: 'jti', role: 'student', email: 'u@e.tlu.edu.vn' }, { expiresIn: '1h' });
        const headers = { authorization: `Bearer ${token}` };
        assert.equal((await app.inject({ ...request, headers })).json().error.code, 'UNAUTHORIZED');
        assert.equal((await app.inject({ ...request, headers })).statusCode, 429);
        assert.equal(counts().reads, 1);
    } finally { await app.close(); }
});

test('native bcrypt login keeps token/user contract and admits existing long passwords', async () => {
    const password = randomBytes(180).toString('hex');
    const passwordHash = await new PasswordHasherBcrypt().hash(password);
    const { app, counts } = await makeApp({ read: async () => ({ id: 'u', email: 'user@e.tlu.edu.vn', role: 'student',
        isActive: true, mustChangePassword: false, passwordHash }) });
    try {
        const result = await app.inject({ ...login(), payload: { email: 'user@e.tlu.edu.vn', password } });
        assert.equal(result.statusCode, 200);
        assert.ok(result.json().accessToken); assert.ok(result.json().refreshToken);
        assert.equal(result.json().user.id, 'u');
        assert.ok(Array.isArray(result.json().user.permissions));
        assert.equal(result.json().user.mustChangePassword, false);
        assert.equal(counts().writes, 1);
    } finally { await app.close(); }
});

test('login and change-password share the same process capacity', async () => {
    const pending = deferred();
    const { app, counts } = await makeApp({ capacity: 1, read: async () => { await pending.promise; return null; } });
    try {
        const first = app.inject(login());
        await until(() => counts().reads === 1);
        const token = app.jwt.sign({ sub: 'u', jti: 'jti', role: 'student', email: 'u@e.tlu.edu.vn' }, { expiresIn: '1h' });
        const response = await app.inject({ method: 'POST', url: '/api/v1/auth/change-password',
            headers: { authorization: `Bearer ${token}` },
            payload: { oldPassword: randomBytes(12).toString('hex'), newPassword: 'new', confirmNewPassword: 'new' } });
        assert.equal(response.statusCode, 503); assert.equal(response.json().error.code, 'AUTH_BUSY');
        assert.equal(counts().reads, 1);
        pending.resolve(); assert.equal((await first).statusCode, 401);
    } finally { pending.resolve(); await app.close(); }
});

test('native HTTP disconnect removes queued login without starting its DB read', async () => {
    const pending = deferred();
    const { app, counts, metrics } = await makeApp({ read: async () => { await pending.promise; return null; } });
    let abandoned: ReturnType<typeof httpRequest> | undefined;
    try {
        const base = await app.listen({ host: '127.0.0.1', port: 0 });
        const first = app.inject(login('active@e.tlu.edu.vn'));
        await until(() => counts().reads === 1);
        abandoned = httpRequest(`${base}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' } });
        abandoned.on('error', () => {});
        abandoned.end(JSON.stringify(login('abandoned@e.tlu.edu.vn').payload));
        await until(async () => (await metrics.registry.metrics()).includes('tlu_auth_password_work{state="queued"} 1'));
        abandoned.destroy();
        await until(async () => (await metrics.registry.metrics()).includes('tlu_auth_password_cancelled_total 1'));
        pending.resolve(); await first;
        assert.equal(counts().reads, 1);
    } finally { abandoned?.destroy(); pending.resolve(); await app.close(); }
});

test('change-password rechecks session after waiting, so revocation prevents starting the mutation', async () => {
    const pending = deferred();
    let revoked = false;
    const { app, counts, metrics } = await makeApp({ revoked: () => revoked, read: async () => { await pending.promise; return null; } });
    try {
        const active = app.inject(login());
        await until(() => counts().reads === 1);
        const token = app.jwt.sign({ sub: 'u', jti: 'jti', role: 'student', email: 'u@e.tlu.edu.vn' }, { expiresIn: '1h' });
        const changing = app.inject({ method: 'POST', url: '/api/v1/auth/change-password',
            headers: { authorization: `Bearer ${token}` },
            payload: { oldPassword: randomBytes(12).toString('hex'), newPassword: 'new', confirmNewPassword: 'new' } });
        await until(async () => (await metrics.registry.metrics()).includes('tlu_auth_password_work{state="queued"} 1'));
        revoked = true; pending.resolve();
        const response = await changing;
        assert.equal(response.statusCode, 401); assert.equal(response.json().error.code, 'TOKEN_REVOKED');
        assert.equal(counts().reads, 1, 'queued change never entered its use case');
        await active;
    } finally { pending.resolve(); await app.close(); }
});
