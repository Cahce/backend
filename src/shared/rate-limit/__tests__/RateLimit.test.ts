import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import Fastify from 'fastify';
import { LocalRateLimitStore } from '../LocalRateLimitStore.js';
import { RedisRateLimitStore } from '../RedisRateLimitStore.js';
import { RequestRateLimit } from '../RequestRateLimit.js';
import { RateLimitExceeded, RateLimitUnavailable } from '../RateLimitStore.js';
import { toErrorResponse } from '../../http/domainError.js';
import { projectSharingRoutes } from '../../../modules/projects/delivery/http/ProjectSharing/Routes.js';
import { projectDiscussionRoutes } from '../../../modules/project-discussion/delivery/http/Routes.js';
import type { ProjectSharingUseCases } from '../../../modules/projects/application/sharing/ProjectSharingUseCases.js';
import type { ProjectDiscussionUseCases } from '../../../modules/project-discussion/application/ProjectDiscussionUseCases.js';

test('one shared store enforces concurrent limits; rejected requests do not extend TTL', async () => {
  let now = 0;
  const store = new LocalRateLimitStore(100, () => now), gates = [new RequestRateLimit(store), new RequestRateLimit(store)];
  const outcomes = await Promise.allSettled(Array.from({ length: 100 }, (_, i) => gates[i % 2].check('account', 10)));
  assert.equal(outcomes.filter(value => value.status === 'fulfilled').length, 10);
  for (const outcome of outcomes) if (outcome.status === 'rejected') assert(outcome.reason instanceof RateLimitExceeded);
  now = 1500;
  await assert.rejects(gates[0].check('account', 10), error => error instanceof RateLimitExceeded && error.retryAfterSeconds === 59);
  now = 60000; await gates[1].check('account', 10);
  assert.equal(gates[0].snapshot().checks + gates[1].snapshot().checks, 102);
});

test('full local store rejects new keys without evicting valid limits and reclaims expired entries', async () => {
  let now = 0; const gate = new RequestRateLimit(new LocalRateLimitStore(2, () => now));
  await gate.check('a', 1); await gate.check('b', 1);
  await assert.rejects(gate.check('c', 1), RateLimitUnavailable);
  await assert.rejects(gate.check('a', 1), RateLimitExceeded);
  now = 60000; await gate.check('c', 1); await gate.check('a', 1);
});

test('Redis adapter uses HMAC keys and rejects bad replies/errors without fallback or sensitive messages', async () => {
  let result: unknown = [1, 60000]; let args: readonly string[] = [];
  const store = new RedisRateLimitStore({ async command(command) { args = command; return result; } }, 'test', randomBytes(32).toString('hex'));
  const gate = new RequestRateLimit(store);
  await gate.check('sharing:private-user', 90);
  assert.equal(args.join(' ').includes('private-user'), false);
  assert.match(args[3], /^test:\{rate-limit\}:window:[a-f0-9]{64}$/);
  result = [0, 1250]; await assert.rejects(gate.check('sharing:private-user', 90), error => error instanceof RateLimitExceeded && error.retryAfterSeconds === 2);
  for (result of [[-1, 1000], [1, 0], [1, Infinity], ['1', 1000], null]) await assert.rejects(gate.check('sharing:private-user', 90), RateLimitUnavailable);
  const failed = new RequestRateLimit({ async take() { throw new Error('secret redis URL'); } });
  const response = await failed.check('sharing:user', 90).catch(toErrorResponse);
  assert.equal(response?.status, 503); assert.equal(response?.retryAfterSeconds, 1);
  assert.equal(JSON.stringify(response).includes('secret'), false);
});

test('two HTTP instances share account quota across routes while distinct NAT users and scopes remain independent', async () => {
  const store = new LocalRateLimitStore(), apps = [Fastify(), Fastify()];
  let reads = 0;
  for (const app of apps) {
    app.decorate('requestRateLimit', new RequestRateLimit(store));
    app.decorate('auth', { async verify(req, reply) {
      const user = req.headers['x-fixture-user'];
      if (typeof user !== 'string') { reply.code(401).send({ error: { code: 'UNAUTHORIZED' } }); return; }
      req.user = { sub: user, role: 'student', email: 'fixture@example.invalid', jti: 'fixture' };
    } } as typeof app.auth);
    app.setErrorHandler((error, _req, reply) => {
      const mapped = toErrorResponse(error);
      if (mapped.retryAfterSeconds) reply.header('Retry-After', mapped.retryAfterSeconds);
      return reply.code(mapped.status).send(mapped.body);
    });
    await app.register(async child => {
      await projectSharingRoutes(child, { async access() { reads++; return {}; } } as unknown as ProjectSharingUseCases);
    });
    await app.register(async child => {
      await projectDiscussionRoutes(child, { async history() { reads++; return { messages: [] }; } } as unknown as ProjectDiscussionUseCases);
    });
  }
  try {
    const call = (index: number, user: string, url = '/projects/fixture/access') => apps[index].inject({ url, headers: { 'x-fixture-user': user }, remoteAddress: '192.0.2.10' });
    const responses = await Promise.all(Array.from({ length: 100 }, (_, i) => call(i % 2, 'one-account')));
    assert.equal(responses.filter(value => value.statusCode === 200).length, 90);
    assert.equal(reads, 90);
    for (const response of responses.filter(value => value.statusCode === 429)) {
      assert.equal(response.json().error.code, 'RATE_LIMITED'); assert(Number(response.headers['retry-after']) > 0);
    }
    assert.equal((await call(0, 'one-account', '/projects/fixture/chat/messages')).statusCode, 200);
    const nat = await Promise.all(Array.from({ length: 100 }, (_, i) => call(i % 2, `nat-${i}`)));
    assert(nat.every(response => response.statusCode === 200));
    const checks = apps[0].requestRateLimit!.snapshot().checks;
    assert.equal((await apps[0].inject('/projects/fixture/access')).statusCode, 401);
    assert.equal(apps[0].requestRateLimit!.snapshot().checks, checks);
    apps[0].requestRateLimit = new RequestRateLimit({ async take() { throw new RateLimitUnavailable(); } });
    // New route scope captures the failing gate; previous routes retain their injected instance.
    const failing = Fastify(); failing.decorate('requestRateLimit', apps[0].requestRateLimit);
    failing.setErrorHandler((error, _req, reply) => { const mapped = toErrorResponse(error); return reply.code(mapped.status).send(mapped.body); });
    failing.get('/work', async () => { await failing.requestRateLimit!.check('a', 1); return {}; });
    try { assert.equal((await failing.inject('/work')).statusCode, 503); } finally { await failing.close(); }
  } finally { await Promise.all(apps.map(app => app.close())); }
});
