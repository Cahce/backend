import { createHmac } from 'node:crypto';
import type { RedisCommands } from '../../../shared/redis/BoundedRedisConnection.js';
import { RealtimeSocketLeaseUnavailable, type RealtimeSocketLease, type RealtimeSocketLeaseStore } from '../domain/RealtimeSocketLeaseStore.js';

const CLOCK = `local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
`;
const ACQUIRE = CLOCK + `
local expired = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', now, 'LIMIT', 0, 512)
if #expired > 0 then redis.call('ZREM', KEYS[1], unpack(expired)) end
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now)
if redis.call('ZSCORE', KEYS[1], ARGV[1]) then return 0 end
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[3]) or redis.call('ZCARD', KEYS[2]) >= 5 then return 0 end
local ttl = tonumber(ARGV[2])
redis.call('ZADD', KEYS[1], now + ttl, ARGV[1])
redis.call('ZADD', KEYS[2], now + ttl, ARGV[1])
redis.call('PEXPIRE', KEYS[1], 16000)
redis.call('PEXPIRE', KEYS[2], 16000)
return 1`;
const RENEW = CLOCK + `
local ttl = tonumber(ARGV[1])
local renewed = {}
for i = 2, #KEYS do
  local id = ARGV[i]
  local global = tonumber(redis.call('ZSCORE', KEYS[1], id))
  local account = tonumber(redis.call('ZSCORE', KEYS[i], id))
  if global and account and global > now and account > now then
    redis.call('ZADD', KEYS[1], now + ttl, id)
    redis.call('ZADD', KEYS[i], now + ttl, id)
    redis.call('PEXPIRE', KEYS[i], 16000)
    table.insert(renewed, id)
  end
end
if #renewed > 0 then redis.call('PEXPIRE', KEYS[1], 16000) end
return renewed`;
const RELEASE = `
if redis.call('ZSCORE', KEYS[2], ARGV[1]) then
  redis.call('ZREM', KEYS[1], ARGV[1])
  redis.call('ZREM', KEYS[2], ARGV[1])
end
return 1`;

export class RedisRealtimeSocketLeaseStore implements RealtimeSocketLeaseStore {
  private readonly prefix: string;
  constructor(private readonly redis: RedisCommands, namespace: string, private readonly secret: string, private readonly globalLimit = 10000) {
    if (!/^[a-zA-Z0-9_-]{1,48}$/.test(namespace) || secret.length < 32 || !Number.isSafeInteger(globalLimit) || globalLimit < 1 || globalLimit > 100000) {
      throw new Error('Invalid socket lease configuration');
    }
    this.prefix = `${namespace}:{socket-leases}:`;
  }
  async acquire(lease: RealtimeSocketLease, ttlMs: number) {
    this.validateTtl(ttlMs);
    const result = await this.execute(['EVAL', ACQUIRE, '2', `${this.prefix}active`, this.accountKey(lease), lease.id, String(ttlMs), String(this.globalLimit)]);
    if (result !== 0 && result !== 1) throw new RealtimeSocketLeaseUnavailable();
    return result === 1;
  }
  async renew(leases: readonly RealtimeSocketLease[], ttlMs: number) {
    this.validateTtl(ttlMs);
    if (!leases.length) return [];
    if (leases.length > 100) throw new RealtimeSocketLeaseUnavailable();
    const result = await this.execute(['EVAL', RENEW, String(leases.length + 1), `${this.prefix}active`, ...leases.map(lease => this.accountKey(lease)),
      String(ttlMs), ...leases.map(lease => lease.id)]);
    const expected = new Set(leases.map(lease => lease.id));
    if (!Array.isArray(result) || result.length > leases.length || !result.every(id => typeof id === 'string' && expected.has(id))) {
      throw new RealtimeSocketLeaseUnavailable();
    }
    return result as string[];
  }
  async release(lease: RealtimeSocketLease) {
    await this.execute(['EVAL', RELEASE, '2', `${this.prefix}active`, this.accountKey(lease), lease.id]);
  }
  private accountKey(lease: RealtimeSocketLease) {
    if (!/^[a-f0-9]{32}$/.test(lease.id) || !lease.userId || lease.userId.length > 256) throw new RealtimeSocketLeaseUnavailable();
    return `${this.prefix}user:${createHmac('sha256', this.secret).update(lease.userId).digest('hex')}`;
  }
  private validateTtl(ttlMs: number) {
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > 15000) throw new RealtimeSocketLeaseUnavailable();
  }
  private async execute(args: string[]) {
    try { return await this.redis.command(args); } catch { throw new RealtimeSocketLeaseUnavailable(); }
  }
}
