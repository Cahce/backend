import fp from 'fastify-plugin';
import { createHash, timingSafeEqual } from 'node:crypto';
import { ServiceMetrics } from '../shared/observability/ServiceMetrics.js';

export const metricsPlugin = fp(async function metricsPlugin(app) {
  if (!app.config.observability.metricsEnabled) return;
  const token = app.config.observability.metricsToken;
  if (!token || token.trim().length < 32) throw new Error('Metrics requires a dedicated token of at least 32 characters');
  const digest = (value: string) => createHash('sha256').update(value).digest();
  const expected = digest(`Bearer ${token}`);
  const metrics = new ServiceMetrics();
  app.decorate('serviceMetrics', metrics);
  metrics.bindAuth(() => app.authSessionMetrics?.());
  // Only route templates registered by this app can become labels. Unknown URLs
  // and unusual methods collapse to fixed buckets, regardless of caller input.
  const routes = new Set<string>();
  app.addHook('onRoute', route => { routes.add(route.url); });
  app.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions.url;
    metrics.observeHttp(request.method, route && routes.has(route) ? route : '__unmatched__', reply.statusCode, reply.elapsedTime / 1000);
  });
  app.addHook('onRequestAbort', async (_request) => { metrics.observeAborted(); });
  // Bound serialization cost: concurrent collectors share one response and the
  // snapshot can be reused for one second. Authorization always precedes reuse.
  let pending: Promise<string> | undefined, cached = '', cachedAt = 0;
  app.get('/metrics', { logLevel: 'silent', schema: { hide: true }, onRequest: async (request, reply) => {
    if (!timingSafeEqual(digest(request.headers.authorization ?? ''), expected)) {
      return reply.header('Cache-Control', 'no-store').code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Không có quyền truy cập' } });
    }
  } }, async (_request, reply) => {
    if (!cached || Date.now() - cachedAt >= 1000) {
      pending ??= metrics.registry.metrics().then(value => { cached = value; cachedAt = Date.now(); return value; })
        .finally(() => { pending = undefined; });
      await pending;
    }
    return reply.header('Cache-Control', 'no-store').type(metrics.registry.contentType).send(cached);
  });
  app.addHook('onClose', async () => { metrics.close(); cached = ''; });
});
