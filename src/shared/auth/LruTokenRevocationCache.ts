import { LRUCache } from 'lru-cache';
import type {
  TokenRevocationCachePort,
  TokenRevocationStatus,
} from './TokenRevocationCachePort.js';

export interface LruTokenRevocationCacheOptions {
  max?: number;
  ttlMs?: number;
}

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
