import { SessionVerificationUnavailable, type TokenSessionIdentity, type TokenSessionReader,
  type TokenSessionState } from '../domain/TokenSession.js';

interface Pending {
  settled: boolean;
  timer: ReturnType<typeof setTimeout>;
  resolve(value: TokenSessionState | null): void;
  reject(reason: unknown): void;
}

interface PendingRead {
  key: string;
  identity: TokenSessionIdentity;
  waiters: Pending[];
}

/** Coalesce only requests waiting for a read, never reuse an in-flight authorization snapshot. */
export class ReadTokenSessionUseCase {
  private pending: PendingRead[] = [];
  private readonly queuedByIdentity = new Map<string, PendingRead>();
  private readonly outstanding = new Set<Pending>();
  private scheduled?: ReturnType<typeof setImmediate>;
  private running = 0;
  private stopped = false;
  private readonly limits;
  private readonly counters = { checks: 0, batches: 0, rejectedCapacity: 0, expiredChecks: 0,
    databaseFailures: 0, lastFailureCode: '', coalescedChecks: 0, identitiesRead: 0 };

  snapshot() { return { ...this.counters, outstanding: this.outstanding.size, running: this.running,
    queued: this.pending.reduce((count, read) => count + read.waiters.length, 0), queuedIdentities: this.pending.length }; }

  constructor(private readonly reader: TokenSessionReader,
    options: { batchSize?: number; maxOutstanding?: number; concurrency?: number; timeoutMs?: number } = {}) {
    // A 100-user editor bootstrap issues 1,800 protected requests. Keep a finite
    // waiter budget above that burst while DB work stays bounded to four reads.
    this.limits = { batchSize: 200, maxOutstanding: 4096, concurrency: 4, timeoutMs: 5000, ...options };
    for (const value of Object.values(this.limits)) {
      if (!Number.isInteger(value) || value < 1) throw new Error('Invalid session verification limits');
    }
  }

  execute(identity: TokenSessionIdentity): Promise<TokenSessionState | null> {
    this.counters.checks++;
    if (this.stopped || this.outstanding.size >= this.limits.maxOutstanding) {
      this.counters.rejectedCapacity++;
      return Promise.reject(new SessionVerificationUnavailable());
    }
    const result = new Promise<TokenSessionState | null>((resolve, reject) => {
      const entry: Pending = { resolve, reject, settled: false,
        timer: setTimeout(() => { this.counters.expiredChecks++; this.reject(entry); }, this.limits.timeoutMs) };
      const key = JSON.stringify([identity.userId, identity.jti]);
      const queued = this.queuedByIdentity.get(key);
      if (queued) { queued.waiters.push(entry); this.counters.coalescedChecks++; }
      else {
        const read = { key, identity: { ...identity }, waiters: [entry] };
        this.pending.push(read); this.queuedByIdentity.set(key, read);
      }
      this.outstanding.add(entry);
    });
    this.schedule();
    return result;
  }

  close() {
    this.stopped = true;
    if (this.scheduled) clearImmediate(this.scheduled);
    this.scheduled = undefined;
    for (const entry of this.outstanding) this.reject(entry);
    this.pending = []; this.queuedByIdentity.clear(); this.outstanding.clear();
  }

  private reject(entry: Pending) {
    if (entry.settled) return;
    entry.settled = true; clearTimeout(entry.timer);
    entry.reject(new SessionVerificationUnavailable());
    // Retain work's slot until dequeued or its DB read settles: a timeout cannot
    // create unlimited abandoned database queries.
  }

  private schedule() {
    if (this.stopped || this.scheduled || this.running >= this.limits.concurrency || !this.pending.length) return;
    this.scheduled = setImmediate(() => {
      this.scheduled = undefined;
      const live: PendingRead[] = [];
      for (const read of this.pending) {
        read.waiters = read.waiters.filter(entry => {
          if (!entry.settled) return true;
          this.outstanding.delete(entry); return false;
        });
        if (read.waiters.length) live.push(read); else this.queuedByIdentity.delete(read.key);
      }
      this.pending = live;
      while (!this.stopped && this.running < this.limits.concurrency && this.pending.length) {
        const batch = this.pending.splice(0, this.limits.batchSize);
        // A later request must never join this snapshot, even while it waits
        // for a pool connection. Only not-yet-dispatched work is coalesced.
        for (const read of batch) this.queuedByIdentity.delete(read.key);
        this.running++;
        void this.read(batch);
      }
    });
  }

  private async read(batch: PendingRead[]) {
    this.counters.batches++;
    this.counters.identitiesRead += batch.length;
    try {
      const states = await this.reader.readMany(batch.map(entry => entry.identity));
      if (states.length !== batch.length) throw new SessionVerificationUnavailable();
      batch.forEach((read, index) => {
        for (const entry of read.waiters) {
          if (entry.settled) continue;
          clearTimeout(entry.timer); entry.settled = true; entry.resolve(states[index]);
        }
      });
    } catch (error) {
      this.counters.databaseFailures++;
      const code = (error as { code?: unknown } | null)?.code;
      this.counters.lastFailureCode = typeof code === 'string' && /^[A-Z0-9_]{2,30}$/.test(code) ? code : 'UNKNOWN';
      for (const read of batch) for (const entry of read.waiters) this.reject(entry);
    } finally {
      for (const read of batch) for (const entry of read.waiters) this.outstanding.delete(entry);
      this.running--; this.schedule();
    }
  }
}
