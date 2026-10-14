-- Atomic fixed-window limit. KEYS[1] is an opaque/HMAC-scoped key.
-- ARGV[1]=positive integer limit, ARGV[2]=window milliseconds.
-- Returns {allowed:0|1, remaining, retryAfterMilliseconds}.
-- Use a coordination Redis with no eviction; not the evicting catalogue cache.
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
if not limit or limit < 1 or limit % 1 ~= 0 or
   not window or window < 1 or window % 1 ~= 0 then
  return redis.error_reply('Invalid rate limit configuration')
end
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if count == 1 or ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], window)
  ttl = window
end
if count > limit then return {0, 0, ttl} end
return {1, limit - count, ttl}
