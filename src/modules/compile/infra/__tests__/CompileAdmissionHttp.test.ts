import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { compileRoutes } from '../../delivery/http/Routes.js';
import { adminCompileRoutes } from '../../delivery/http/AdminRoutes.js';
import { CompileJobError } from '../../domain/Errors.js';
import type { CompileContainer } from '../../Container.js';

test('member and admin compile routes expose explicit overload and unavailable errors', async () => {
  for (const [code, status] of [['COMPILE_QUEUE_FULL', 429], ['COMPILE_UNAVAILABLE', 503]] as const) {
    const app = Fastify({ logger: false, ajv: { customOptions: { strict: false } } });
    app.decorate('auth', { verify: async (req: { user: unknown }) => { req.user = { sub: 'owner', role: 'student' }; },
      requireAdmin: async () => {}, requireRoles: () => async () => {}, requirePermission: () => async () => {} });
    const fail = async () => { throw new CompileJobError(code, 'Thử lại sau'); };
    const container = { enqueueCompileJob: { execute: fail }, getLatestProjectArtifactForAdmin: { execute: fail } } as unknown as CompileContainer;
    await compileRoutes(app, container);
    await app.register(child => adminCompileRoutes(child, container), { prefix: '/admin' });
    try {
      for (const response of [await app.inject({ method: 'POST', url: '/projects/p/compile', payload: { entryPath: 'main.typ' } }),
        await app.inject({ method: 'GET', url: '/admin/projects/p/artifact' })]) {
        assert.equal(response.statusCode, status);
        assert.deepEqual(response.json(), { error: { code, message: 'Thử lại sau' } });
      }
    } finally { await app.close(); }
  }
});
