import { Counter, Gauge, Histogram, Registry } from '@prometheus-io/client';
import { monitorEventLoopDelay } from 'node:perf_hooks';

export interface PoolSnapshot { total: number; idle: number; waiting: number }
export interface RedisSnapshot { ready: number; pending: number; attempts: number; completed: number; errors: number; timeouts: number; rejected: number }
export interface RateLimitSnapshot { checks: number; admitted: number; limited: number; unavailable: number }
export interface PasswordWorkSnapshot { admitted: number; rejected: number; expired: number; cancelled: number; completed: number; running: number; queued: number }
export interface RealtimeSnapshot { connections: number; authenticated: number; accounts: number; rooms: number; queued: number;
  activeReplays: number; activeReplayRecipients?: number }
export interface AuthSnapshot {
  checks: number; batches: number; rejectedCapacity: number; expiredChecks: number; databaseFailures: number;
  coalescedChecks: number; identitiesRead: number; outstanding: number; running: number; queued: number;
}
const SECONDS = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const OPERATIONS = new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'BEGIN', 'COMMIT', 'ROLLBACK', 'SET']);

/** Process-scoped instrumentation. Never stores SQL, bind values or caller identifiers. */
export class ServiceMetrics {
  readonly registry = new Registry();
  private readonly http = new Histogram({ name: 'tlu_http_request_duration_seconds', help: 'Completed HTTP requests.',
    labelNames: ['method', 'route', 'status_class'] as const, buckets: SECONDS, registers: [this.registry] });
  private readonly aborted = new Counter({ name: 'tlu_http_aborted_total', help: 'Requests aborted before completion.',
    registers: [this.registry] });
  private readonly queries = new Histogram({ name: 'tlu_db_query_duration_seconds', help: 'Prisma query event duration.',
    labelNames: ['operation'] as const, buckets: SECONDS, registers: [this.registry] });
  private readonly acquisition = new Histogram({ name: 'tlu_db_pool_acquire_seconds', help: 'Pool acquisition including queue wait.',
    labelNames: ['result'] as const, buckets: SECONDS, registers: [this.registry] });
  private readonly passwordWork = new Histogram({ name: 'tlu_auth_password_duration_seconds', help: 'Queue wait for started work and execution time for settled work. Check expiry/rejection counters separately.',
    labelNames: ['phase'] as const, buckets: SECONDS, registers: [this.registry] });
  private readonly poolErrors = new Counter({ name: 'tlu_db_pool_idle_errors_total', help: 'Idle PostgreSQL connection errors.',
    registers: [this.registry] });
  private readonly loop = monitorEventLoopDelay({ resolution: 20 });
  private readonly timer: ReturnType<typeof setInterval>;
  private poolSnapshot?: () => PoolSnapshot;
  private authSnapshot?: () => AuthSnapshot | undefined;
  private closed = false;

  constructor() {
    const pool = new Gauge({ name: 'tlu_db_pool_connections', help: 'Primary pool state.',
      labelNames: ['state'] as const, registers: [this.registry], collect: () => {
        const snapshot = this.poolSnapshot?.();
        if (!snapshot) return;
        pool.set({ state: 'total' }, snapshot.total); pool.set({ state: 'idle' }, snapshot.idle);
        pool.set({ state: 'waiting' }, snapshot.waiting);
      } });
    const memory = new Gauge({ name: 'tlu_process_memory_bytes', help: 'API process memory, excludes native children.',
      labelNames: ['kind'] as const, registers: [this.registry], collect: () => {
        const value = process.memoryUsage();
        memory.set({ kind: 'rss' }, value.rss); memory.set({ kind: 'heap_used' }, value.heapUsed);
        memory.set({ kind: 'external' }, value.external);
      } });
    const cpu = new Gauge({ name: 'tlu_process_cpu_seconds', help: 'Cumulative API process CPU, excludes native children.',
      labelNames: ['kind'] as const, registers: [this.registry], collect: () => {
        const value = process.cpuUsage(); cpu.set({ kind: 'user' }, value.user / 1e6); cpu.set({ kind: 'system' }, value.system / 1e6);
      } });
    for (const [key, suffix] of Object.entries({ checks: 'checks', batches: 'batches', rejectedCapacity: 'rejected_capacity',
      expiredChecks: 'expired_checks', databaseFailures: 'database_failures', coalescedChecks: 'coalesced_checks', identitiesRead: 'identities_read' })) {
      const read = () => this.authSnapshot?.();
      new Counter({ name: `tlu_auth_session_${suffix}_total`, help: `Auth session ${suffix}.`, registers: [this.registry],
        collect() {
          const snapshot = read();
          if (snapshot) { this.reset(); this.inc(snapshot[key as keyof AuthSnapshot]); }
        } });
    }
    const authWork = new Gauge({ name: 'tlu_auth_session_work', help: 'Auth session work in this process.',
      labelNames: ['state'] as const, registers: [this.registry], collect: () => {
        const value = this.authSnapshot?.(); if (!value) return;
        authWork.set({ state: 'outstanding' }, value.outstanding); authWork.set({ state: 'running' }, value.running);
        authWork.set({ state: 'queued' }, value.queued);
      } });
    const loop = new Gauge({ name: 'tlu_event_loop_delay_seconds', help: 'Event loop delay during the last five seconds.',
      labelNames: ['quantile'] as const, registers: [this.registry] });
    this.loop.enable();
    this.timer = setInterval(() => {
      for (const quantile of [0.5, 0.95, 0.99]) loop.set({ quantile: String(quantile) },
        this.loop.count ? this.loop.percentile(quantile * 100) / 1e9 : 0);
      this.loop.reset();
    }, 5000);
    this.timer.unref();
  }

  bindPool(read: () => PoolSnapshot) { this.poolSnapshot = read; }
  observePasswordWork(phase: 'queue' | 'execution', milliseconds: number) {
    if (!this.closed) this.passwordWork.observe({ phase }, Math.max(0, milliseconds / 1000));
  }
  bindPasswordWork(read: () => PasswordWorkSnapshot) {
    const state = new Gauge({ name: 'tlu_auth_password_work', help: 'Password work in this API process.',
      labelNames: ['state'] as const, registers: [this.registry], collect: () => {
        const value = read(); state.set({ state: 'running' }, value.running); state.set({ state: 'queued' }, value.queued);
      } });
    for (const key of ['admitted', 'rejected', 'expired', 'cancelled', 'completed'] as const) {
      new Counter({ name: `tlu_auth_password_${key}_total`, help: `Password work ${key}.`, registers: [this.registry],
        collect() { this.reset(); this.inc(read()[key]); } });
    }
  }
  bindRealtime(read: () => RealtimeSnapshot) {
    const state = new Gauge({ name: 'tlu_realtime_state', help: 'Realtime state in this API process. activeReplays counts room/page cohorts, activeReplayRecipients counts their recipients. Account counts are not cluster-unique.',
      labelNames: ['state'] as const, registers: [this.registry], collect: () => {
        const snapshot = read();
        for (const key of ['connections', 'authenticated', 'accounts', 'rooms', 'queued', 'activeReplays'] as const) {
          state.set({ state: key }, snapshot[key]);
        }
        if (snapshot.activeReplayRecipients !== undefined) state.set({ state: 'activeReplayRecipients' }, snapshot.activeReplayRecipients);
      } });
  }
  bindRateLimit(read: () => RateLimitSnapshot) {
    for (const key of ['checks', 'admitted', 'limited', 'unavailable'] as const) {
      new Counter({ name: `tlu_rate_limit_${key}_total`, help: `Rate limit ${key}.`, registers: [this.registry],
        collect() { this.reset(); this.inc(read()[key]); } });
    }
  }
  bindRedis(read: () => RedisSnapshot) {
    const work = new Gauge({ name: 'tlu_redis_state', help: 'Shared Redis client state, only when enabled.',
      labelNames: ['state'] as const, registers: [this.registry], collect: () => {
        const value = read(); work.set({ state: 'ready' }, value.ready); work.set({ state: 'pending' }, value.pending);
      } });
    for (const key of ['attempts', 'completed', 'errors', 'timeouts', 'rejected'] as const) {
      new Counter({ name: `tlu_redis_${key}_total`, help: `Shared Redis client ${key}.`, registers: [this.registry],
        collect() { this.reset(); this.inc(read()[key]); } });
    }
  }
  bindAuth(read: () => AuthSnapshot | undefined) { this.authSnapshot = read; }
  observeHttp(method: string, route: string, status: number, seconds: number) {
    if (this.closed) return;
    this.http.observe({ method: METHODS.has(method) ? method : 'OTHER', route,
      status_class: status >= 100 && status < 600 ? `${Math.floor(status / 100)}xx` : 'other' }, Math.max(0, seconds));
  }
  observeAborted() { if (!this.closed) this.aborted.inc(); }
  observeQuery(query: string, milliseconds: number) {
    if (this.closed) return;
    const operation = /^\s*([a-z]+)/i.exec(query)?.[1]?.toUpperCase() ?? 'OTHER';
    this.queries.observe({ operation: OPERATIONS.has(operation) ? operation : 'OTHER' }, Math.max(0, milliseconds / 1000));
  }
  observeAcquisition(seconds: number, failed: boolean) {
    if (!this.closed) this.acquisition.observe({ result: failed ? 'error' : 'success' }, Math.max(0, seconds));
  }
  observePoolError() { if (!this.closed) this.poolErrors.inc(); }
  close() {
    if (this.closed) return;
    this.closed = true; clearInterval(this.timer); this.loop.disable(); this.registry.clear();
    this.poolSnapshot = undefined; this.authSnapshot = undefined;
  }
}
