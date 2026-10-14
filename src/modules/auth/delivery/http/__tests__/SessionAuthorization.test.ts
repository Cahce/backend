import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { jwtPlugin } from '../../../../../plugins/JWT.js';
import type { AppConfig } from '../../../../../config/index.js';
import type { TokenSessionReader, TokenSessionState } from '../../../domain/TokenSession.js';

async function makeApp(reader: TokenSessionReader, secret: string) {
  const app = Fastify();
  app.decorate('config', { auth: { jwtSecret: secret } } as AppConfig);
  await app.register(jwtPlugin, { sessionReader: reader });
  app.get('/protected', { preHandler: app.auth.verify }, req => ({ role: req.user.role }));
  app.get('/admin', { preHandler: app.auth.requireAdmin }, () => ({ ok: true }));
  for (const [method, path] of [['GET', 'me'], ['POST', 'change-password'], ['POST', 'logout']] as const) {
    app.route({ method, url: `/api/v1/auth/${path}`, preHandler: app.auth.verify, handler: async () => ({ ok: true }) });
  }
  return app;
}

test('two instances see revocation/current role/account flags despite warm local caches', async () => {
  const secret = randomBytes(32).toString('hex'), jti = randomUUID();
  let current: TokenSessionState = { userId: 'u', role: 'admin', isActive: true, mustChangePassword: false, revoked: false };
  const reader: TokenSessionReader = { async readMany(inputs) { return inputs.map(() => ({ ...current })); } };
  const a = await makeApp(reader, secret), b = await makeApp(reader, secret);
  try {
    const headers = { authorization: `Bearer ${a.jwt.sign({ sub: 'u', jti, role: 'admin', email: 'u@example.invalid' }, { expiresIn: '1h' })}` };
    assert.equal((await b.inject({ url: '/admin', headers })).statusCode, 200);
    current = { ...current, role: 'student' };
    assert.equal((await b.inject({ url: '/admin', headers })).statusCode, 403);
    assert.equal((await b.inject({ url: '/protected', headers })).json().role, 'student');
    current = { ...current, mustChangePassword: true };
    assert.equal((await b.inject({ url: '/protected', headers })).json().error.code, 'PASSWORD_CHANGE_REQUIRED');
    for (const [method, path] of [['GET', 'me'], ['POST', 'change-password'], ['POST', 'logout']] as const) {
      assert.equal((await b.inject({ method, url: `/api/v1/auth/${path}`, headers })).statusCode, 200);
    }
    current = { ...current, mustChangePassword: false, isActive: false };
    assert.equal((await b.inject({ url: '/protected', headers })).statusCode, 401);
    current = { ...current, isActive: true, revoked: true };
    a.tokenRevocationCache.set(jti, 'revoked');
    b.tokenRevocationCache.set(jti, 'valid'); // Even legacy callers cannot cache allow.
    assert.equal(b.tokenRevocationCache.get(jti), undefined);
    assert.equal((await b.inject({ url: '/protected', headers })).json().error.code, 'TOKEN_REVOKED');
  } finally { await Promise.all([a.close(), b.close()]); }
});

test('invalid/expired tokens avoid DB work; a DB outage returns bounded retryable denial', async () => {
  let reads = 0;
  const app = await makeApp({ async readMany() { reads++; throw new Error('offline'); } }, randomBytes(32).toString('hex'));
  try {
    assert.equal((await app.inject({ url: '/protected' })).statusCode, 401);
    const payload = { sub: 'u', jti: randomUUID(), email: 'u@example.invalid', role: 'student' as const };
    const expired = app.jwt.sign(payload, { expiresIn: -1 });
    assert.equal((await app.inject({ url: '/protected', headers: { authorization: `Bearer ${expired}` } })).json().error.code, 'TOKEN_EXPIRED');
    assert.equal(reads, 0);
    const valid = app.jwt.sign(payload, { expiresIn: '1h' });
    const response = await app.inject({ url: '/protected', headers: { authorization: `Bearer ${valid}` } });
    assert.equal(response.statusCode, 503);
    assert.equal(response.headers['retry-after'], '1');
    assert.equal(response.json().error.code, 'AUTH_UNAVAILABLE');
  } finally { await app.close(); }
});
