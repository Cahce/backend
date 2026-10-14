import type { Pool, PoolClient } from 'pg';
import { performance } from 'node:perf_hooks';
import type { ServiceMetrics } from './ServiceMetrics.js';

/** Preserve both public pg acquisition APIs and their ownership/release semantics. */
export function observePgPool(pool: Pool, metrics: ServiceMetrics) {
  const original = pool.connect;
  const acquire = original.bind(pool);
  const observed = ((callback?: (error: Error | undefined, client: PoolClient | undefined,
    release: (error?: Error | boolean) => void) => void) => {
    const start = performance.now();
    if (callback) return acquire((error, client, release) => {
      metrics.observeAcquisition((performance.now() - start) / 1000, !!error);
      callback(error, client, release);
    });
    return acquire().then(client => {
      metrics.observeAcquisition((performance.now() - start) / 1000, false); return client;
    }, error => { metrics.observeAcquisition((performance.now() - start) / 1000, true); throw error; });
  }) as typeof pool.connect;
  pool.connect = observed;
  metrics.bindPool(() => ({ total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount }));
  return () => { if (pool.connect === observed) pool.connect = original; };
}
