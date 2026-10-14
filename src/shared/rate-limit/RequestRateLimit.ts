import { LocalRateLimitStore } from './LocalRateLimitStore.js';
import { RateLimitExceeded, RateLimitUnavailable, type RateLimitStore } from './RateLimitStore.js';

/** Transport admission only. Call after authentication for account-scoped limits. */
export class RequestRateLimit {
  private readonly counters = { checks: 0, admitted: 0, limited: 0, unavailable: 0 };
  constructor(private readonly store: RateLimitStore = new LocalRateLimitStore()) {}
  snapshot() { return { ...this.counters }; }
  async check(key: string, limit: number, windowMs = 60000): Promise<void> {
    if (!key || key.length > 1024 || !Number.isSafeInteger(limit) || limit < 1 || limit > 1_000_000 ||
      !Number.isSafeInteger(windowMs) || windowMs < 1 || windowMs > 86_400_000) throw new Error('Invalid rate limit policy');
    this.counters.checks++;
    let decision;
    try { decision = await this.store.take(key, limit, windowMs); }
    catch {
      this.counters.unavailable++;
      throw new RateLimitUnavailable();
    }
    if (!decision.allowed) { this.counters.limited++; throw new RateLimitExceeded(decision.retryAfterMs); }
    this.counters.admitted++;
  }
}
