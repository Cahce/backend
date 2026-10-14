export type RateLimitDecision = { allowed: boolean; retryAfterMs: number };
export interface RateLimitStore {
  take(key: string, limit: number, windowMs: number): Promise<RateLimitDecision>;
}
export class RateLimitUnavailable extends Error {
  constructor() { super('Rate limit dependency unavailable'); this.name = 'RateLimitUnavailable'; }
}
export class RateLimitExceeded extends Error {
  readonly retryAfterSeconds: number;
  constructor(retryAfterMs: number) {
    super('Request rate limit exceeded'); this.name = 'RateLimitExceeded';
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  }
}
