import { RealtimeSocketLeaseUnavailable, type RealtimeSocketLease, type RealtimeSocketLeaseStore } from '../domain/RealtimeSocketLeaseStore.js';

export interface RealtimeSocketLeaseHandle { valid(): boolean; release(): Promise<void> }
type HeldLease = { lease: RealtimeSocketLease; deadline: number; lost: () => void };

/** Monotonic local deadlines fence sends even when timers or dependency replies arrive late. */
export class RealtimeSocketLeases {
  private readonly held = new Map<string, HeldLease>();
  private readonly releasing = new Set<Promise<void>>();
  private stopped = false;
  private renewing = false;
  private readonly renewTimer: ReturnType<typeof setInterval>;
  private readonly expiryTimer: ReturnType<typeof setInterval>;
  constructor(private readonly store: RealtimeSocketLeaseStore, private readonly generate: () => string,
    private readonly options = { ttlMs: 15000, renewEveryMs: 5000, sweepMs: 500 }, private readonly now: () => number = () => performance.now()) {
    if (!Number.isSafeInteger(options.ttlMs) || options.ttlMs < 1 || options.ttlMs > 15000 ||
      options.renewEveryMs < 1 || options.renewEveryMs >= options.ttlMs || options.sweepMs < 1 || options.sweepMs > options.ttlMs) {
      throw new Error('Invalid realtime lease timing');
    }
    this.renewTimer = setInterval(() => { void this.renew(); }, options.renewEveryMs);
    this.expiryTimer = setInterval(() => {
      for (const entry of this.held.values()) if (entry.deadline <= this.now()) this.lose(entry);
    }, options.sweepMs);
    this.renewTimer.unref(); this.expiryTimer.unref();
  }
  async acquire(userId: string, lost: () => void): Promise<RealtimeSocketLeaseHandle | undefined> {
    if (this.stopped) throw new RealtimeSocketLeaseUnavailable();
    const lease = { id: this.generate(), userId }, deadline = this.now() + this.options.ttlMs;
    let acquired: boolean;
    try { acquired = await this.store.acquire(lease, this.options.ttlMs); }
    catch { await this.releaseStore(lease); throw new RealtimeSocketLeaseUnavailable(); }
    if (!acquired) return undefined;
    if (this.stopped || deadline <= this.now()) { await this.releaseStore(lease); throw new RealtimeSocketLeaseUnavailable(); }
    const entry = { lease, deadline, lost };
    this.held.set(lease.id, entry);
    return {
      valid: () => !this.stopped && this.held.get(lease.id) === entry && entry.deadline > this.now(),
      release: () => { if (this.held.get(lease.id) !== entry) return Promise.resolve(); this.held.delete(lease.id); return this.releaseStore(lease); },
    };
  }
  async stop() {
    this.stopped = true; clearInterval(this.renewTimer); clearInterval(this.expiryTimer);
    for (const entry of this.held.values()) { this.held.delete(entry.lease.id); void this.releaseStore(entry.lease); }
    await Promise.allSettled(this.releasing);
  }
  private async renew() {
    if (this.stopped || this.renewing) return;
    this.renewing = true;
    try {
      const entries = [...this.held.values()];
      for (let i = 0; i < entries.length && !this.stopped; i += 100) {
        const batch = entries.slice(i, i + 100).filter(entry => this.held.get(entry.lease.id) === entry);
        const start = this.now();
        for (const entry of batch) if (entry.deadline <= start) this.lose(entry);
        const live = batch.filter(entry => this.held.get(entry.lease.id) === entry);
        if (!live.length) continue;
        try {
          const renewed = new Set(await this.store.renew(live.map(entry => entry.lease), this.options.ttlMs));
          const now = this.now();
          for (const entry of live) {
            if (this.held.get(entry.lease.id) !== entry) continue;
            if (this.stopped || entry.deadline <= now || start + this.options.ttlMs <= now || !renewed.has(entry.lease.id)) this.lose(entry);
            else entry.deadline = start + this.options.ttlMs;
          }
        } catch { for (const entry of live) this.lose(entry); }
      }
    } finally { this.renewing = false; }
  }
  private lose(entry: HeldLease) {
    if (this.held.get(entry.lease.id) !== entry) return;
    this.held.delete(entry.lease.id);
    try { entry.lost(); } catch { /* A closed transport must not stop expiry of other leases. */ }
    finally { void this.releaseStore(entry.lease); }
  }
  private releaseStore(lease: RealtimeSocketLease) {
    const pending = Promise.resolve().then(() => this.store.release(lease)).catch(() => { /* TTL reclaims reservations when Redis is unavailable. */ });
    this.releasing.add(pending);
    void pending.finally(() => this.releasing.delete(pending));
    return pending;
  }
}
