import { LRUCache } from 'lru-cache';
import type {
  TokenRevocationCachePort,
  TokenRevocationStatus,
} from './TokenRevocationCachePort.js';

export interface LruTokenRevocationCacheOptions {
  /** Số entry tối đa. Mặc định 5_000. */
  max?: number;
  /** TTL mỗi entry (ms). Mặc định 60_000 (60s). */
  ttlMs?: number;
}

/**
 * In-memory LRU implementation của `TokenRevocationCachePort`.
 *
 * - `max: 5_000` × ~50 byte/entry ≈ 250 KB RAM tối đa — bounded.
 * - `ttl: 60_000` đảm bảo logout race nhỏ; entry stale tự bay sau 60s nếu
 *   không gọi `delete`.
 */
export class LruTokenRevocationCache implements TokenRevocationCachePort {
  private readonly cache: LRUCache<string, TokenRevocationStatus>;

  constructor(opts: LruTokenRevocationCacheOptions = {}) {
    this.cache = new LRUCache<string, TokenRevocationStatus>({
      max: opts.max ?? 5_000,
      ttl: opts.ttlMs ?? 60_000,
    });
  }

  get(jti: string): TokenRevocationStatus | undefined {
    return this.cache.get(jti);
  }

  set(jti: string, status: TokenRevocationStatus): void {
    this.cache.set(jti, status);
  }

  delete(jti: string): void {
    this.cache.delete(jti);
  }
}
