import { createHmac } from 'node:crypto';
import { z } from 'zod';
import type { RedisCommands } from '../../../shared/redis/BoundedRedisConnection.js';
import { RealtimeTicketStoreUnavailable, type RealtimeTicketStore, type StoredRealtimeTicket,
  type TicketReservation } from '../domain/RealtimeTicketStore.js';

// Server time bounds TTL/quota even when an API clock is ahead. All keys share a hash tag.
const ISSUE = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local deadline = math.min(tonumber(ARGV[1]), now + 30000)
if deadline <= now then return 3 end
if redis.call('EXISTS', KEYS[1]) == 1 then return 2 end
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now)
redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', now)
if redis.call('ZCARD', KEYS[2]) >= 5000 or redis.call('ZCARD', KEYS[3]) >= 10 then return 0 end
redis.call('HSET', KEYS[1], 'payload', ARGV[2], 'owner', ARGV[3])
redis.call('PEXPIREAT', KEYS[1], deadline)
redis.call('ZADD', KEYS[2], deadline, ARGV[4])
redis.call('ZADD', KEYS[3], deadline, ARGV[4])
redis.call('PEXPIRE', KEYS[2], 31000)
redis.call('PEXPIRE', KEYS[3], 31000)
return 1`;

const TAKE = `
local payload = redis.call('HGET', KEYS[1], 'payload')
local owner = redis.call('HGET', KEYS[1], 'owner')
redis.call('DEL', KEYS[1])
redis.call('ZREM', KEYS[2], ARGV[1])
if owner and string.len(owner) == 64 and string.match(owner, '^%x+$') then
  redis.call('ZREM', ARGV[2] .. owner, ARGV[1])
end
return payload`;

const entrySchema = z.object({ deadline: z.number().int().positive(), session: z.object({
  actor: z.object({ userId: z.string().min(1).max(256), role: z.enum(['admin', 'student', 'teacher']) }),
  projectId: z.string().min(1).max(256), jti: z.string().min(1).max(256), expiresAt: z.number().int().positive(),
}) });

/** Normal-operation one-use across processes; Redis failover rollback requires a separate HA gate. */
export class RedisRealtimeTicketStore implements RealtimeTicketStore {
  private readonly prefix: string;
  constructor(private readonly redis: RedisCommands, namespace: string, private readonly keySecret: string) {
    if (!/^[a-zA-Z0-9_-]{1,48}$/.test(namespace) || keySecret.length < 32) throw new Error('Invalid shared ticket configuration');
    this.prefix = `${namespace}:{realtime-tickets}:`;
  }
  async put(hash: string, entry: StoredRealtimeTicket): Promise<TicketReservation> {
    try {
      this.validateHash(hash);
      const payload = JSON.stringify(entrySchema.parse(entry));
      const owner = createHmac('sha256', this.keySecret).update(entry.session.actor.userId).digest('hex');
      const result = await this.redis.command(['EVAL', ISSUE, '3', `${this.prefix}ticket:${hash}`, `${this.prefix}pending`,
        `${this.prefix}user:${owner}`, String(entry.deadline), payload, owner, hash]);
      if (result === 0) return 'capacity';
      if (result === 1) return 'stored';
      if (result === 2) return 'collision';
      if (result === 3) return 'expired';
      throw new RealtimeTicketStoreUnavailable();
    } catch { throw new RealtimeTicketStoreUnavailable(); }
  }
  async take(hash: string): Promise<StoredRealtimeTicket | undefined> {
    try {
      this.validateHash(hash);
      const result = await this.redis.command(['EVAL', TAKE, '2', `${this.prefix}ticket:${hash}`, `${this.prefix}pending`, hash, `${this.prefix}user:`]);
      if (result === null) return undefined;
      if (typeof result !== 'string' || result.length > 4096) throw new RealtimeTicketStoreUnavailable();
      return entrySchema.parse(JSON.parse(result));
    } catch { throw new RealtimeTicketStoreUnavailable(); }
  }
  private validateHash(hash: string) {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new RealtimeTicketStoreUnavailable();
  }
}
