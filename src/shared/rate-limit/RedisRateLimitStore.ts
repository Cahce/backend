import { createHmac } from 'node:crypto';
import type { RedisCommands } from '../redis/BoundedRedisConnection.js';
import { RateLimitUnavailable, type RateLimitStore, type RateLimitDecision } from './RateLimitStore.js';

const TAKE = `
local limit = tonumber(ARGV[1])
local count = tonumber(redis.call('GET', KEYS[1]))
if count then
  local ttl = redis.call('PTTL', KEYS[1])
  if ttl < 0 then return {-1, 1000} end
  if count >= limit then return {0, math.max(ttl, 1)} end
  redis.call('INCR', KEYS[1])
  return {1, math.max(ttl, 1)}
end
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local expired = redis.call('ZRANGEBYSCORE', KEYS[2], '-inf', now, 'LIMIT', 0, 512)
if #expired > 0 then redis.call('ZREM', KEYS[2], unpack(expired)) end
if redis.call('ZCARD', KEYS[2]) >= 100000 then return {-1, 1000} end
local window = tonumber(ARGV[2])
redis.call('SET', KEYS[1], '1', 'PX', window)
redis.call('ZADD', KEYS[2], now + window, ARGV[3])
redis.call('PEXPIRE', KEYS[2], 86401000)
return {1, window}`;

export class RedisRateLimitStore implements RateLimitStore {
  private readonly prefix: string;
  constructor(private readonly redis: RedisCommands, namespace: string, private readonly keySecret: string) {
    if (!/^[a-zA-Z0-9_-]{1,48}$/.test(namespace) || keySecret.length < 32) throw new Error('Invalid rate limit configuration');
    this.prefix = `${namespace}:{rate-limit}:`;
  }
  async take(key: string, limit: number, windowMs: number): Promise<RateLimitDecision> {
    try {
      const hash = createHmac('sha256', this.keySecret).update(key).digest('hex');
      const result = await this.redis.command(['EVAL', TAKE, '2', `${this.prefix}window:${hash}`, `${this.prefix}pending`,
        String(limit), String(windowMs), hash]);
      if (!Array.isArray(result) || result.length !== 2 || ![0, 1].includes(result[0]) ||
        !Number.isSafeInteger(result[1]) || result[1] < 1 || result[1] > 86_400_000) throw new RateLimitUnavailable();
      return { allowed: result[0] === 1, retryAfterMs: result[1] };
    } catch { throw new RateLimitUnavailable(); }
  }
}
