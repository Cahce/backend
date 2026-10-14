import { RateLimitUnavailable, type RateLimitStore, type RateLimitDecision } from './RateLimitStore.js';

export class LocalRateLimitStore implements RateLimitStore {
  private readonly windows = new Map<string, { deadline: number; count: number }>();
  private sweep?: MapIterator<[string, { deadline: number; count: number }]>;
  constructor(private readonly maxKeys = 100_000, private readonly now: () => number = Date.now) {}
  async take(key: string, limit: number, windowMs: number): Promise<RateLimitDecision> {
    const now = this.now();
    let entry = this.windows.get(key);
    if (!entry || entry.deadline <= now) {
      if (!entry && this.windows.size >= this.maxKeys) {
        // A full map must not turn each new identity into an O(maxKeys) scan.
        this.sweep ??= this.windows.entries();
        for (let remaining = 512; remaining > 0; remaining--) {
          const next = this.sweep.next();
          if (next.done) { this.sweep = undefined; break; }
          if (next.value[1].deadline <= now) this.windows.delete(next.value[0]);
        }
        if (this.windows.size >= this.maxKeys) throw new RateLimitUnavailable();
      }
      entry = { deadline: now + windowMs, count: 0 }; this.windows.set(key, entry);
    }
    const allowed = entry.count < limit;
    if (allowed) entry.count++;
    return { allowed, retryAfterMs: Math.max(1, entry.deadline - now) };
  }
}
