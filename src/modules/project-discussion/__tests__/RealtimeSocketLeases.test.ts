import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { RealtimeSocketLeases } from '../application/RealtimeSocketLeases.js';
import { LocalRealtimeSocketLeaseStore } from '../infra/LocalRealtimeSocketLeaseStore.js';
import { RedisRealtimeSocketLeaseStore } from '../infra/RedisRealtimeSocketLeaseStore.js';
import { RealtimeSocketLeaseUnavailable, type RealtimeSocketLeaseStore } from '../domain/RealtimeSocketLeaseStore.js';

const generate = () => randomBytes(16).toString('hex');
async function until(condition: () => boolean) {
  for (let i = 0; i < 100 && !condition(); i++) await delay(5);
  assert(condition());
}

test('two managers sharing a store cannot exceed five/account or global cap and release slots on close', async () => {
  const store = new LocalRealtimeSocketLeaseStore(8);
  const managers = [new RealtimeSocketLeases(store, generate), new RealtimeSocketLeases(store, generate)];
  try {
    const results = await Promise.all(Array.from({ length: 30 }, (_, i) => managers[i % 2].acquire('same-user', () => {})));
    const granted = results.filter(value => value !== undefined);
    assert.equal(granted.length, 5);
    for (let i = 0; i < 3; i++) assert(await managers[0].acquire(`user-${i}`, () => {}));
    assert.equal(await managers[1].acquire('overflow', () => {}), undefined);
    await granted[0].release(); assert.equal(granted[0].valid(), false);
    assert(await managers[1].acquire('same-user', () => {}));
  } finally { await Promise.all(managers.map(manager => manager.stop())); }
  assert(await store.acquire({ id: generate(), userId: 'after-shutdown' }, 15000));
});

test('local expiry is recoverable after process loss; wrong-owner release and late renew cannot steal or revive', async () => {
  let now = 0; const store = new LocalRealtimeSocketLeaseStore(1, 5, () => now);
  const lease = { id: generate(), userId: 'owner' };
  assert(await store.acquire(lease, 100));
  await store.release({ ...lease, userId: 'other' });
  assert.equal(await store.acquire({ id: generate(), userId: 'other' }, 100), false);
  now = 101;
  assert.deepEqual(await store.renew([lease], 100), []);
  assert(await store.acquire({ id: generate(), userId: 'other' }, 100));
});

test('late acquire after shutdown is released and never returns a usable handle', async () => {
  let finish!: (value: boolean) => void, released = 0;
  const store: RealtimeSocketLeaseStore = { acquire: () => new Promise(resolve => { finish = resolve; }),
    async renew() { return []; }, async release() { released++; } };
  const manager = new RealtimeSocketLeases(store, generate);
  const rejected = assert.rejects(manager.acquire('user', () => {}), RealtimeSocketLeaseUnavailable);
  await manager.stop(); finish(true); await rejected;
  assert.equal(released, 1);
});

test('hanging renew does not overlap, expiry remains active and a late success cannot revive a handle', async () => {
  let now = 0, renewCalls = 0, lost = 0, released = 0;
  let finish!: (value: string[]) => void, id = '';
  const manager = new RealtimeSocketLeases({ async acquire(lease) { id = lease.id; return true; },
    renew() { renewCalls++; return new Promise(resolve => { finish = resolve; }); }, async release() { released++; } },
  generate, { ttlMs: 100, renewEveryMs: 10, sweepMs: 5 }, () => now);
  try {
    const handle = await manager.acquire('user', () => { lost++; }); assert(handle);
    await until(() => renewCalls === 1); await delay(30); assert.equal(renewCalls, 1);
    now = 101; assert.equal(handle.valid(), false);
    await until(() => lost === 1);
    finish([id]); await delay(10);
    assert.equal(handle.valid(), false); assert.equal(lost, 1); assert.equal(released, 1);
  } finally { await manager.stop(); }
});

test('renew batches at most 100, handles missing reservations and ignores late response after local expiry', async () => {
  let now = 0, lost = 0; const sizes: number[] = [];
  const store: RealtimeSocketLeaseStore = { async acquire() { return true; }, async renew(leases) {
    sizes.push(leases.length); return leases.slice(1).map(lease => lease.id);
  }, async release() {} };
  const manager = new RealtimeSocketLeases(store, generate, { ttlMs: 100, renewEveryMs: 20, sweepMs: 100 }, () => now);
  try {
    const handles = await Promise.all(Array.from({ length: 101 }, (_, i) => manager.acquire(`user-${i}`, () => { lost++; })));
    await until(() => sizes.length >= 2);
    assert.deepEqual(sizes.slice(0, 2), [100, 1]); assert.equal(lost, 2);
    now = 101;
    assert(handles.every(handle => handle?.valid() === false));
  } finally { await manager.stop(); }
});

test('Redis lease adapter hides user identifiers and validates batch replies and bounds', async () => {
  let result: unknown = 1, args: readonly string[] = [];
  const store = new RedisRealtimeSocketLeaseStore({ async command(command) { args = command; return result; } }, 'test', randomBytes(32).toString('hex'));
  const lease = { id: generate(), userId: 'private-user' };
  assert(await store.acquire(lease, 15000));
  assert.equal(args.join(' ').includes('private-user'), false);
  assert.match(args[4], /^test:\{socket-leases\}:user:[a-f0-9]{64}$/);
  result = [lease.id]; assert.deepEqual(await store.renew([lease], 15000), [lease.id]);
  result = ['unexpected']; await assert.rejects(store.renew([lease], 15000), RealtimeSocketLeaseUnavailable);
  await assert.rejects(store.renew(Array.from({ length: 101 }, () => lease), 15000), RealtimeSocketLeaseUnavailable);
  await assert.rejects(store.acquire(lease, 15001), RealtimeSocketLeaseUnavailable);
});
