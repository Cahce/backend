import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import type { HealthProbe } from '../modules/health/domain/HealthProbe.js';
import { PrismaHealthProbe } from '../modules/health/infra/PrismaHealthProbe.js';
import { ReadinessMonitor } from '../modules/health/application/ReadinessMonitor.js';

export interface ServiceLifecycle {
  readonly isDraining: boolean;
  readonly isReady: boolean;
  beginDrain(): void;
}

export const lifecyclePlugin = fp(async function lifecyclePlugin(app: FastifyInstance, options: { probe?: HealthProbe }) {
  const primary = options.probe ?? new PrismaHealthProbe(app.prisma);
  const monitor = new ReadinessMonitor({ async check() {
    // Wait for every dependency to settle: an early Redis rejection must not hide
    // a still-running primary probe and allow overlapping database queries.
    const results = await Promise.allSettled([primary.check(), ...(app.sharedRedis ? [app.sharedRedis.command(['PING'])] : [])]);
    if (results.some(result => result.status === 'rejected')) throw new Error('Readiness dependency unavailable');
  } });
  let draining = false;
  app.decorate('lifecycle', {
    get isDraining() { return draining; },
    get isReady() { return !draining && monitor.ready && (!app.sharedRedis || app.sharedRedis.isReady); },
    beginDrain() { draining = true; },
  } satisfies ServiceLifecycle);
  app.addHook('onReady', async () => { monitor.start(); });
  app.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?', 1)[0];
    if (draining && path !== '/health' && path !== '/health/live' && path !== '/health/ready' && path !== '/metrics') {
      return reply.header('Retry-After', '1').code(503).send({
        error: { code: 'SERVER_DRAINING', message: 'Máy chủ đang khởi động lại. Vui lòng thử lại' },
      });
    }
  });
  app.addHook('preClose', async () => { draining = true; monitor.stop(); });
});
