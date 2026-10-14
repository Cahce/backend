import fp from 'fastify-plugin';
import { BoundedRedisConnection } from '../shared/redis/BoundedRedisConnection.js';
import { RequestRateLimit } from '../shared/rate-limit/RequestRateLimit.js';
import { LocalRateLimitStore } from '../shared/rate-limit/LocalRateLimitStore.js';
import { RedisRateLimitStore } from '../shared/rate-limit/RedisRateLimitStore.js';

export const sharedStatePlugin = fp(async function sharedStatePlugin(app) {
  const options = app.config.sharedState;
  const connection = options.driver === 'redis' ? new BoundedRedisConnection({ ...options, url: options.url! }) : undefined;
  const rateLimit = new RequestRateLimit(connection
    ? new RedisRateLimitStore(connection, options.namespace, options.keySecret!) : new LocalRateLimitStore());
  app.decorate('requestRateLimit', rateLimit);
  app.serviceMetrics?.bindRateLimit(() => rateLimit.snapshot());
  if (!connection) return;
  app.decorate('sharedRedis', connection);
  app.serviceMetrics?.bindRedis(() => connection.snapshot());
  app.addHook('onReady', async () => { await connection.start(); });
  app.addHook('onClose', async () => { connection.stop(); });
});
