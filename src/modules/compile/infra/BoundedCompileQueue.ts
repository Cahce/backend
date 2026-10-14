import type { CompileQueue } from '../domain/CompileQueue.js';
import type { CompileJob } from '../domain/CompileJob.js';
import type { CompileJobRepository } from '../domain/CompileJobRepository.js';
import { CompileJobError } from '../domain/Errors.js';

interface RecoveryRepository extends CompileJobRepository {
  findAllQueued(limit?: number, excludeIds?: string[]): Promise<CompileJob[]>;
  findRunningOlderThan(olderThan: Date, limit?: number, excludeIds?: string[]): Promise<CompileJob[]>;
}
export interface BoundedCompileQueueOptions {
  enabled: boolean;
  timeoutMs: number;
  maxOutstandingJobs?: number;
  log?: { info(msg: string): void; error(msg: string, error?: unknown): void };
}

/** One active compiler; the bound includes active, queued and not-yet-created jobs. */
export class BoundedCompileQueue implements CompileQueue {
  private readonly queue: string[] = [];
  private readonly accepted = new Set<string>();
  private readonly admissions = new Map<string, Promise<unknown>>();
  private readonly settleWaiters = new Map<string, Array<() => void>>();
  private active?: string;
  private reservations = 0;
  private stopped = false;
  private recovering?: Promise<void>;
  private startup?: Promise<void>;
  private recoverySweep?: Promise<void>;
  private recoveryTimer?: ReturnType<typeof setInterval>;
  private readonly capacity: number;

  constructor(private readonly handler: { execute(jobId: string): Promise<void> }, private readonly jobs: RecoveryRepository,
    private readonly options: BoundedCompileQueueOptions) {
    this.capacity = options.maxOutstandingJobs ?? 32;
    if (!Number.isInteger(this.capacity) || this.capacity < 1) throw new Error('Compile queue capacity must be a positive integer');
  }

  /** Reserve before DB creation, and coalesce same-entry callers across both enqueue use cases. */
  admit<T>(key: string, work: (enqueue: (jobId: string) => Promise<void>) => Promise<T>): Promise<T> {
    this.requireEnabled();
    const existing = this.admissions.get(key);
    if (existing) return existing as Promise<T>;
    const release = this.reserve();
    let committed = false;
    const enqueue = async (jobId: string) => {
      if (committed) throw new Error('Compile admission was already consumed');
      this.requireEnabled();
      committed = true;
      release();
      this.accept(jobId);
    };
    const pending = Promise.resolve().then(() => work(enqueue)).finally(() => {
      release();
      if (this.admissions.get(key) === pending) this.admissions.delete(key);
    });
    this.admissions.set(key, pending);
    return pending;
  }

  async enqueue(jobId: string): Promise<void> {
    this.requireEnabled();
    if (this.accepted.has(jobId)) return;
    const release = this.reserve();
    release();
    this.accept(jobId);
  }

  hasJob(jobId: string): boolean { return this.accepted.has(jobId); }

  private requireEnabled() {
    if (!this.options.enabled || this.stopped) throw new CompileJobError('COMPILE_UNAVAILABLE', 'Trình biên dịch đang tạm dừng. Hãy thử lại sau');
  }
  private reserve(): () => void {
    this.requireEnabled();
    if (this.accepted.size + this.reservations >= this.capacity) throw new CompileJobError('COMPILE_QUEUE_FULL', 'Hàng đợi biên dịch đã đầy. Hãy thử lại sau');
    this.reservations++;
    let released = false;
    return () => { if (!released) { released = true; this.reservations--; } };
  }
  private accept(jobId: string) {
    if (this.accepted.has(jobId)) return;
    this.accepted.add(jobId);
    this.queue.push(jobId);
    void this.processNext();
  }

  start(): void {
    if (!this.options.enabled || this.startup) return;
    this.stopped = false;
    this.startup = this.sweep();
    // Also revisit recently interrupted running jobs after their grace period.
    // Own active work is excluded even while snapshot/storage is still running.
    this.recoveryTimer = setInterval(() => { void this.sweep(); }, 5000);
    this.recoveryTimer.unref();
  }

  private sweep(): Promise<void> {
    if (this.stopped || !this.options.enabled) return Promise.resolve();
    if (this.recoverySweep) return this.recoverySweep;
    const sweep = (async () => {
      const stale = await this.jobs.findRunningOlderThan(
        new Date(Date.now() - 2 * this.options.timeoutMs), this.capacity, [...this.accepted]);
      for (const job of stale) {
        if (this.stopped) return;
        if (this.accepted.has(job.id) || job.status !== 'running') continue;
        job.fail([{ severity: 'error', message: 'Job bị gián đoạn do máy chủ khởi động lại' }]);
        await this.jobs.save(job);
      }
      await this.refill();
    })().catch(error => this.options.log?.error('Failed to recover compile jobs', error)).finally(() => {
      if (this.recoverySweep === sweep) this.recoverySweep = undefined;
    });
    this.recoverySweep = sweep;
    return sweep;
  }

  private refill(): Promise<void> {
    if (this.stopped || !this.options.enabled) return Promise.resolve();
    if (this.recovering) return this.recovering;
    const room = this.capacity - this.accepted.size - this.reservations;
    if (room <= 0) return Promise.resolve();
    const pending = (async () => {
      const jobs = await this.jobs.findAllQueued(room, [...this.accepted]);
      for (const job of jobs) {
        if (this.stopped || this.accepted.size + this.reservations >= this.capacity) break;
        if (!this.accepted.has(job.id)) await this.enqueue(job.id);
      }
    })().catch(error => this.options.log?.error('Failed to refill compile queue', error)).finally(() => {
      if (this.recovering === pending) this.recovering = undefined;
    });
    this.recovering = pending;
    return pending;
  }

  waitForSettle(jobId: string, signal?: AbortSignal): Promise<void> {
    return new Promise(resolve => {
      if (signal?.aborted || this.stopped) { resolve(); return; }
      const done = () => {
        signal?.removeEventListener('abort', done);
        const remaining = this.settleWaiters.get(jobId)?.filter(item => item !== done);
        if (remaining?.length) this.settleWaiters.set(jobId, remaining);
        else this.settleWaiters.delete(jobId);
        resolve();
      };
      const waiters = this.settleWaiters.get(jobId) ?? [];
      waiters.push(done); this.settleWaiters.set(jobId, waiters);
      signal?.addEventListener('abort', done, { once: true });
    });
  }

  async stop(): Promise<void> {
    this.stopped = true;
    clearInterval(this.recoveryTimer);
    await Promise.allSettled(this.admissions.values());
    await this.startup;
    await this.recoverySweep;
    await this.recovering;
    while (this.active) await new Promise(resolve => setTimeout(resolve, 10));
    // Unstarted jobs remain durable queued rows and are recovered on the next start.
    this.queue.length = 0; this.accepted.clear();
    const waiters = [...this.settleWaiters.values()].flat();
    this.settleWaiters.clear();
    for (const resolve of waiters) resolve();
  }

  private async processNext(): Promise<void> {
    if (this.stopped || this.active) return;
    const jobId = this.queue.shift();
    if (!jobId) return;
    this.active = jobId;
    try { await this.handler.execute(jobId); }
    catch (error) { this.options.log?.error('Compile job failed', error); }
    finally {
      this.active = undefined; this.accepted.delete(jobId);
      const waiters = this.settleWaiters.get(jobId); this.settleWaiters.delete(jobId);
      for (const resolve of waiters ?? []) resolve();
      await this.refill();
      if (!this.stopped && this.queue.length) setImmediate(() => { void this.processNext(); });
    }
  }
}
