import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { BoundedRedisConnection } from '../src/shared/redis/BoundedRedisConnection.js';
import { RedisRealtimeTicketStore } from '../src/modules/project-discussion/infra/RedisRealtimeTicketStore.js';
import { RealtimeTickets } from '../src/modules/project-discussion/application/RealtimeTickets.js';
import { ShareTokenCrypto } from '../src/modules/projects/infra/sharing/ShareTokenCrypto.js';
import type { RealtimeSession } from '../src/modules/project-discussion/domain/RealtimePorts.js';
import { RequestRateLimit } from '../src/shared/rate-limit/RequestRateLimit.js';
import { RedisRateLimitStore } from '../src/shared/rate-limit/RedisRateLimitStore.js';
import { RateLimitExceeded } from '../src/shared/rate-limit/RateLimitStore.js';
import { RedisRealtimeSocketLeaseStore } from '../src/modules/project-discussion/infra/RedisRealtimeSocketLeaseStore.js';

// Explicit test endpoint only: never read the application's REDIS_URL or load .env implicitly.
const url = process.env.TEST_REDIS_URL;
if (!url || !/^rediss?:\/\//.test(url)) throw new Error('Set TEST_REDIS_URL to a dedicated Redis test service; this gate cannot be skipped.');

test('real Redis: two independent clients, atomic ticket admission/consume and expiry', { timeout: 60000 }, async t => {
  const namespace = `capacity-test-${randomBytes(8).toString('hex')}`;
  const secret = randomBytes(32).toString('hex');
  const options = { url, commandTimeoutMs: 1000, connectTimeoutMs: 2000, maxPending: 128 };
  const clients = [new BoundedRedisConnection(options), new BoundedRedisConnection(options)];
  const stores = clients.map(client => new RedisRealtimeTicketStore(client, namespace, secret));
  const leaseStores = clients.map(client => new RedisRealtimeSocketLeaseStore(client, namespace, secret, 8));
  const crypto = new ShareTokenCrypto();
  const session = (userId = 'fixture-user'): RealtimeSession => ({ actor: { userId, role: 'student' },
    projectId: 'fixture-project', jti: 'fixture-session', expiresAt: Date.now() + 60000 });
  let allowed = true;
  const tickets = stores.map(store => new RealtimeTickets(crypto, { async validate() { return allowed; } }, store));
  try {
    await Promise.all(clients.map(client => client.start()));
    assert(clients.every(client => client.isReady), 'Redis test service is unavailable (endpoint intentionally redacted)');
    await t.test('ticket issued at A is consumed exactly once across A and B', async () => {
      const issued = await tickets[0].create(session());
      const results = await Promise.allSettled(Array.from({ length: 40 }, (_, i) => tickets[i % 2].consume('fixture-project', issued.ticket)));
      assert.equal(results.filter(value => value.status === 'fulfilled').length, 1);
    });
    await t.test('wrong project burns credential; primary policy is checked after take', async () => {
      const wrong = await tickets[0].create(session());
      await assert.rejects(tickets[1].consume('wrong-project', wrong.ticket), { code: 'INVALID_REALTIME_TICKET' });
      await assert.rejects(tickets[0].consume('fixture-project', wrong.ticket), { code: 'INVALID_REALTIME_TICKET' });
      const revoked = await tickets[0].create(session()); allowed = false;
      await assert.rejects(tickets[1].consume('fixture-project', revoked.ticket), { code: 'PROJECT_ACCESS_DENIED' });
      allowed = true;
      await assert.rejects(tickets[0].consume('fixture-project', revoked.ticket), { code: 'INVALID_REALTIME_TICKET' });
    });
    await t.test('concurrent per-user quota is ten across clients, take releases it immediately', async () => {
      const results = await Promise.allSettled(Array.from({ length: 40 }, (_, i) => tickets[i % 2].create(session('quota-user'))));
      const successful = results.filter(result => result.status === 'fulfilled');
      assert.equal(successful.length, 10);
      for (const result of successful) await tickets[1].consume('fixture-project', result.value.ticket);
      const next = await tickets[0].create(session('quota-user'));
      await tickets[1].consume('fixture-project', next.ticket);
    });
    await t.test('global quota is 5000; collisions never overwrite an existing ticket', async () => {
      const hashes: string[] = [];
      // Batches keep client admission bounded; every account is distinct to isolate global quota.
      for (let offset = 0; offset < 5000; offset += 100) {
        const outcomes = await Promise.all(Array.from({ length: 100 }, async (_, j) => {
          const i = offset + j, hash = crypto.hash(crypto.generate()); hashes.push(hash);
          return stores[i % 2].put(hash, { session: session(`global-user-${i}`), deadline: Date.now() + 30000 });
        }));
        assert(outcomes.every(value => value === 'stored'));
      }
      const entry = { session: session('global-overflow'), deadline: Date.now() + 30000 };
      assert.equal(await stores[1].put(crypto.hash(crypto.generate()), entry), 'capacity');
      assert.equal(await stores[1].put(hashes[0], entry), 'collision');
      assert.equal((await stores[0].take(hashes[0]))?.session.actor.userId, 'global-user-0');
      for (let i = 0; i < hashes.length; i += 100) await Promise.all(hashes.slice(i, i + 100).map(hash => stores[1].take(hash)));
    });
    await t.test('rate windows are atomic across clients, account scoped and do not extend on denial', async () => {
      const gates = clients.map(client => new RequestRateLimit(new RedisRateLimitStore(client, namespace, secret)));
      const outcomes = await Promise.allSettled(Array.from({ length: 40 }, (_, i) => gates[i % 2].check('sharing:account', 12, 500)));
      assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 12);
      for (const outcome of outcomes) if (outcome.status === 'rejected') assert(outcome.reason instanceof RateLimitExceeded);
      await gates[1].check('sharing:other-account', 12, 500);
      await gates[1].check('discussion:account', 12, 500);
      await delay(300);
      await assert.rejects(gates[0].check('sharing:account', 12, 500), RateLimitExceeded);
      await delay(250);
      await gates[1].check('sharing:account', 12, 500);
    });
    await t.test('socket reservation is atomic across clients and enforces account/global limits with owner-scoped release', async () => {
      const leases = Array.from({ length: 30 }, () => ({ id: randomBytes(16).toString('hex'), userId: 'same-lease-user' }));
      const results = await Promise.all(leases.map((lease, i) => leaseStores[i % 2].acquire(lease, 15000)));
      const granted = leases.filter((_lease, i) => results[i]); assert.equal(granted.length, 5);
      for (let i = 0; i < 3; i++) {
        const lease = { id: randomBytes(16).toString('hex'), userId: `other-lease-user-${i}` };
        assert(await leaseStores[1].acquire(lease, 15000)); granted.push(lease);
      }
      const overflow = { id: randomBytes(16).toString('hex'), userId: 'overflow' };
      assert.equal(await leaseStores[0].acquire(overflow, 15000), false);
      await leaseStores[1].release({ ...granted[0], userId: 'wrong-owner' });
      assert.equal(await leaseStores[0].acquire(overflow, 15000), false);
      assert.equal((await leaseStores[1].renew(granted, 15000)).length, 8);
      await leaseStores[0].release(granted[0]); assert(await leaseStores[1].acquire(overflow, 15000));
      await Promise.all([...granted, overflow].map(lease => leaseStores[1].release(lease)));
    });
    await t.test('short leases cannot expire shared indexes holding longer leases; expired reservations cannot renew', async () => {
      const long = { id: randomBytes(16).toString('hex'), userId: 'long-lease' };
      const short = { id: randomBytes(16).toString('hex'), userId: 'short-lease' };
      assert(await leaseStores[0].acquire(long, 5000)); assert(await leaseStores[0].acquire(short, 200));
      await delay(1400);
      assert.deepEqual(await leaseStores[1].renew([short, long], 5000), [long.id]);
      await leaseStores[1].release(long);
    });
    await t.test('expiry frees quota after an issuing client disconnects', async () => {
      const hashes = Array.from({ length: 10 }, () => crypto.hash(crypto.generate()));
      for (const hash of hashes) await stores[0].put(hash, { session: session('expired-user'), deadline: Date.now() + 300 });
      for (let i = 0; i < 8; i++) assert(await leaseStores[0].acquire({ id: randomBytes(16).toString('hex'), userId: `crash-${i}` }, 300));
      const recovered = { id: randomBytes(16).toString('hex'), userId: 'recovered' };
      assert.equal(await leaseStores[1].acquire(recovered, 300), false);
      clients[0].stop();
      await delay(450);
      assert(await leaseStores[1].acquire(recovered, 300)); await leaseStores[1].release(recovered);
      assert.equal(await stores[1].take(hashes[0]), undefined);
      const next = await tickets[1].create(session('expired-user'));
      await tickets[1].consume('fixture-project', next.ticket);
      await assert.rejects(tickets[0].create(session()), { code: 'REALTIME_UNAVAILABLE' });
    });
  } finally {
    try {
    // Scope cleanup to this generated namespace; no FLUSHDB/FLUSHALL or application keys.
    const cleanup = clients.find(client => client.isReady);
    if (cleanup) {
      assert.match(namespace, /^capacity-test-[a-f0-9]{16}$/);
      let cursor = '0';
      do {
        const result = await cleanup.command(['SCAN', cursor, 'MATCH', `${namespace}:*`, 'COUNT', '200']);
        assert(Array.isArray(result) && typeof result[0] === 'string' && Array.isArray(result[1]));
        cursor = result[0];
        const keys = result[1] as string[];
        assert(keys.every(key => typeof key === 'string' && key.startsWith(`${namespace}:`)));
        if (keys.length) await cleanup.command(['UNLINK', ...keys]);
      } while (cursor !== '0');
    }
    } finally { for (const client of clients) client.stop(); }
  }
});
