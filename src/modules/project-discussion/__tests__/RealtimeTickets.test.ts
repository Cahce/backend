import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { RealtimeTickets } from '../application/RealtimeTickets.js';
import { LocalRealtimeTicketStore } from '../infra/LocalRealtimeTicketStore.js';
import { RedisRealtimeTicketStore } from '../infra/RedisRealtimeTicketStore.js';
import { ShareTokenCrypto } from '../../projects/infra/sharing/ShareTokenCrypto.js';
import { RealtimeTicketStoreUnavailable } from '../domain/RealtimeTicketStore.js';
import type { RealtimeSession } from '../domain/RealtimePorts.js';

const session = (userId = 'user'): RealtimeSession => ({ actor: { userId, role: 'student' },
  projectId: 'project', jti: 'session', expiresAt: Date.now() + 60000 });
const policy = { async validate() { return true; } };
const code = (expected: string) => (error: unknown) => (error as { code?: string }).code === expected;

test('one-use and wrong-project consume burns the ticket; malformed input never reaches storage', async () => {
  const tickets = new RealtimeTickets(new ShareTokenCrypto(), policy, new LocalRealtimeTicketStore());
  const issued = await tickets.create(session());
  const results = await Promise.allSettled(Array.from({ length: 30 }, () => tickets.consume('project', issued.ticket)));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const wrong = await tickets.create(session());
  await assert.rejects(tickets.consume('other', wrong.ticket), code('INVALID_REALTIME_TICKET'));
  await assert.rejects(tickets.consume('project', wrong.ticket), code('INVALID_REALTIME_TICKET'));
  const invalid = new RealtimeTickets(new ShareTokenCrypto(), policy, { async put() { throw Error('unexpected'); }, async take() { throw Error('unexpected'); } });
  await assert.rejects(invalid.consume('project', 'invalid'), code('INVALID_REALTIME_TICKET'));
});

test('permission is rechecked after atomic consume, and store failure is retryable without local fallback', async () => {
  let allowed = true;
  const tickets = new RealtimeTickets(new ShareTokenCrypto(), { async validate() { return allowed; } }, new LocalRealtimeTicketStore());
  const issued = await tickets.create(session()); allowed = false;
  await assert.rejects(tickets.consume('project', issued.ticket), code('PROJECT_ACCESS_DENIED'));
  allowed = true;
  await assert.rejects(tickets.consume('project', issued.ticket), code('INVALID_REALTIME_TICKET'));
  const unavailable = new RealtimeTickets(new ShareTokenCrypto(), policy, {
    async put() { throw new RealtimeTicketStoreUnavailable(); }, async take() { throw new RealtimeTicketStoreUnavailable(); },
  });
  await assert.rejects(unavailable.create(session()), code('REALTIME_UNAVAILABLE'));
  await assert.rejects(unavailable.consume('project', issued.ticket), code('REALTIME_UNAVAILABLE'));
});

test('local adapter enforces account/global quotas, releases consumes, prunes expiry and never overwrites collisions', async () => {
  let now = Date.now(); const store = new LocalRealtimeTicketStore(() => now);
  const entry = { session: session(), deadline: now + 30000 };
  const outcomes = await Promise.all(Array.from({ length: 11 }, (_, i) => store.put(String(i), entry)));
  assert.equal(outcomes.filter(value => value === 'stored').length, 10);
  assert.equal(await store.put('0', entry), 'collision');
  await store.take('0'); assert.equal(await store.put('extra', entry), 'stored');
  for (let i = 10; i < 5000; i++) assert.equal(await store.put(`global-${i}`, { ...entry, session: session(`user-${i}`) }), 'stored');
  assert.equal(await store.put('overflow', { ...entry, session: session('other') }), 'capacity');
  now += 30001;
  assert.equal(await store.take('extra'), undefined);
  assert.equal(await store.put('expired', entry), 'expired');
  assert.equal(await store.put('fresh', { ...entry, deadline: now + 30000 }), 'stored');
});

test('token collision retry is bounded and session TTL caps ticket lifetime', async () => {
  const crypto = new ShareTokenCrypto(), fixed = crypto.generate();
  const tickets = new RealtimeTickets({ ...crypto, generate: () => fixed, hash: value => crypto.hash(value) }, policy, new LocalRealtimeTicketStore());
  const current = session(); current.expiresAt = Date.now() + 1000;
  const result = await tickets.create(current);
  assert.equal(Date.parse(result.expiresAt), current.expiresAt);
  await assert.rejects(tickets.create(current), code('REALTIME_UNAVAILABLE'));
  await assert.rejects(tickets.create({ ...current, expiresAt: Date.now() - 1 }), code('INVALID_REALTIME_TICKET'));
});

test('Redis adapter hashes quota identifiers, validates reply payloads and never leaks upstream errors', async () => {
  const commands: (readonly string[])[] = []; let response: unknown = 1;
  const store = new RedisRealtimeTicketStore({ async command(args) { commands.push(args); return response; } }, 'test', randomBytes(32).toString('hex'));
  const crypto = new ShareTokenCrypto(), ticket = crypto.generate(), hash = crypto.hash(ticket);
  assert.equal(await store.put(hash, { session: session(), deadline: Date.now() + 30000 }), 'stored');
  const args = commands[0]; assert.equal(args.includes(ticket), false);
  assert.match(args[5], /^test:\{realtime-tickets\}:user:[a-f0-9]{64}$/);
  response = null; assert.equal(await store.take(hash), undefined);
  response = '{broken'; await assert.rejects(store.take(hash), RealtimeTicketStoreUnavailable);
  response = JSON.stringify({ session: session(), deadline: Date.now() + 30000 });
  assert.equal((await store.take(hash))?.session.projectId, 'project');
  const failed = new RedisRealtimeTicketStore({ async command() { throw new Error('private credential'); } }, 'test', randomBytes(32).toString('hex'));
  await assert.rejects(failed.take(hash), error => error instanceof RealtimeTicketStoreUnavailable && !error.message.includes('private'));
});
