import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import Fastify from 'fastify';
import { WebSocket } from 'ws';
import { registerProjectRealtime } from '../delivery/ws/ProjectRealtime.js';
import { RealtimeSocketLeases } from '../application/RealtimeSocketLeases.js';
import { LocalRealtimeSocketLeaseStore } from '../infra/LocalRealtimeSocketLeaseStore.js';
import type { ProjectEventWakeSource, RealtimeSession } from '../domain/RealtimePorts.js';
import type { ProjectDiscussionUseCases } from '../application/ProjectDiscussionUseCases.js';

const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
async function until(condition: () => boolean, timeout = 2000) {
  const end = Date.now() + timeout;
  while (!condition() && Date.now() < end) await pause(5);
  assert(condition(), 'condition did not become true before deadline');
}
function deferred() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; }
class WakeSource implements ProjectEventWakeSource {
  listeners = new Set<(projectId: string) => void>();
  starts = 0; stops = 0;
  async start() { this.starts++; }
  async stop() { this.stops++; }
  subscribe(listener: (projectId: string) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  wake(projectId = 'p') { for (const listener of this.listeners) listener(projectId); }
}
type Page = Awaited<ReturnType<ProjectDiscussionUseCases['events']>>;
function page(since: string, head: number, projectId = 'p'): Page {
  const first = Number(since) + 1, last = Math.min(head, first + 99);
  const events = Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => ({ type: 'project.metadata.updated',
    projectId, seq: String(first + i), accessVersion: '1', occurredAt: new Date().toISOString(), data: {} }));
  return { events, nextCursor: String(last), highWatermark: String(head), hasMore: last < head };
}
async function fixture(events: ProjectDiscussionUseCases['events'], validate: (s: RealtimeSession) => Promise<boolean> = async () => true,
  suppliedLeases?: RealtimeSocketLeases, maxConnections = 200, eventsBatch?: ProjectDiscussionUseCases['eventsBatch']) {
  const app = Fastify(), source = new WakeSource(), clients: WebSocket[] = [];
  const tickets = { consume: async (projectId: string, ticket: string): Promise<RealtimeSession> => ({ projectId,
    actor: { userId: ticket, role: 'student' }, jti: ticket, expiresAt: Date.now() + 60_000 }), validate };
  const leases = suppliedLeases ?? new RealtimeSocketLeases(new LocalRealtimeSocketLeaseStore(), () => randomBytes(16).toString('hex'));
  registerProjectRealtime(app, tickets, { events, ...(eventsBatch ? { eventsBatch } : {}) }, ['http://realtime.test'], leases, source, maxConnections);
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address(); assert(address && typeof address !== 'string');
  return { source, app, url: `ws://127.0.0.1:${address.port}/api/v1/projects/p/realtime`, async connect(since = '0', projectId = 'p') {
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/api/v1/projects/${projectId}/realtime`, { origin: 'http://realtime.test' });
    clients.push(socket);
    const frames: (Page & { type: string })[] = [];
    socket.on('message', data => frames.push(JSON.parse(data.toString())));
    await new Promise<void>((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
    const userId = randomBytes(32).toString('base64url');
    socket.send(JSON.stringify({ type: 'authenticate', ticket: userId, since }));
    await until(() => frames.some(f => f.type === 'ready'));
    return { socket, frames, userId, sequences: () => frames.flatMap(f => f.events?.map(e => e.seq) ?? []) };
  }, async close() {
    for (const socket of clients) socket.terminate();
    await app.close();
  } };
}

test('shutdown sends service-restart close and stops wake subscriptions', async () => {
  const f = await fixture(async () => page('0', 0));
  try {
    const client = await f.connect();
    const closed = new Promise<number>(resolve => client.socket.once('close', resolve));
    await f.app.close();
    assert.equal(await closed, 1012);
    assert.equal(f.source.listeners.size, 0);
    assert.equal(f.source.stops, 1);
  } finally { await f.close(); }
});

test('expired capacity lease closes a native socket and prevents a late replay page from being sent', async () => {
  let now = 0, entered = false;
  const gate = deferred();
  const leases = new RealtimeSocketLeases(new LocalRealtimeSocketLeaseStore(10, 5, () => now),
    () => randomBytes(16).toString('hex'), { ttlMs: 100, renewEveryMs: 20, sweepMs: 5 }, () => now);
  const f = await fixture(async () => { entered = true; await gate.promise; return page('0', 1); }, async () => true, leases);
  try {
    const client = await f.connect(); await until(() => entered);
    const closed = new Promise<number>(resolve => client.socket.once('close', resolve));
    now = 101;
    assert.equal(await closed, 1013);
    gate.resolve(); await pause(30);
    assert.deepEqual(client.sequences(), []);
  } finally { gate.resolve(); await f.close(); }
});

test('client close during lease acquisition releases a late reservation without reading or sending replay', async () => {
  let finish!: (value: boolean) => void, entered = false, released = 0, reads = 0;
  const leases = new RealtimeSocketLeases({ acquire() { entered = true; return new Promise(resolve => { finish = resolve; }); },
    async renew() { return []; }, async release() { released++; } }, () => randomBytes(16).toString('hex'));
  const f = await fixture(async () => { reads++; return page('0', 1); }, async () => true, leases);
  const socket = new WebSocket(f.url, { origin: 'http://realtime.test' });
  const frames: string[] = []; socket.on('message', data => frames.push(data.toString()));
  try {
    await new Promise<void>((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
    socket.send(JSON.stringify({ type: 'authenticate', ticket: randomBytes(32).toString('base64url') }));
    await until(() => entered);
    const closed = new Promise<void>(resolve => socket.once('close', () => resolve())); socket.terminate(); await closed;
    finish(true); await until(() => released === 1);
    assert.equal(reads, 0); assert.deepEqual(frames, []);
  } finally { socket.terminate(); await f.close(); }
});

test('transport connection cap returns retryable 503 while Origin rejection remains forbidden', async () => {
  const f = await fixture(async () => page('0', 0), async () => true, undefined, 1);
  try {
    await f.connect();
    const rejected = new WebSocket(f.url, { origin: 'http://realtime.test' });
    rejected.on('error', () => {});
    const response = await new Promise<{ status?: number; retry?: string }>(resolve => {
      rejected.once('unexpected-response', (request, reply) => {
        resolve({ status: reply.statusCode, retry: reply.headers['retry-after'] }); request.destroy();
      });
    });
    assert.equal(response.status, 503); assert.equal(response.retry, '1'); rejected.terminate();
  } finally { await f.close(); }
});

test('shutdown bounds the wait for a client that does not read or acknowledge close', { timeout: 5000 }, async () => {
  const f = await fixture(async () => page('0', 0));
  try {
    const client = await f.connect();
    client.socket.pause();
    const started = Date.now();
    await f.app.close();
    assert(Date.now() - started < 3500, 'an unresponsive client cannot hold shutdown indefinitely');
    client.socket.resume();
  } finally { await f.close(); }
});

test('wake burst coalesces by room; idle sockets do not replay every authorization tick; missed wake falls back', { timeout: 15_000 }, async () => {
  let head = 0, reads = 0;
  const f = await fixture(async (projectId, _actor, since) => { reads++; return page(since, head, projectId); });
  try {
    const a = await f.connect(); await until(() => reads === 1);
    head = 1;
    for (let i = 0; i < 100; i++) f.source.wake();
    await until(() => a.sequences().includes('1'));
    assert.equal(reads, 2, '100 wake hints require one replay');
    f.source.wake('another-project'); await pause(2200);
    assert.equal(reads, 2, 'independent authorization must not poll event rows');
    const frames = a.frames.length;
    head = 2; // Simulates a notification lost while the dedicated listener is disconnected.
    await until(() => a.sequences().includes('2'), 10_500);
    assert.equal(reads, 3);
    assert.equal(a.frames.length, frames + 1);
    assert.equal(f.source.starts, 1);
  } finally { await f.close(); }
  assert.equal(f.source.listeners.size, 0); assert.equal(f.source.stops, 1);
});

test('backlog drains without poll delay and concurrent replays are bounded across rooms', { timeout: 10_000 }, async () => {
  let active = 0, maximum = 0;
  const f = await fixture(async (projectId, _actor, since) => {
    active++; maximum = Math.max(maximum, active);
    try { await pause(10); return page(since, 250, projectId); } finally { active--; }
  });
  try {
    const start = Date.now();
    const clients = await Promise.all(Array.from({ length: 20 }, (_, i) => f.connect('0', `p${i}`)));
    await until(() => clients.every(c => c.sequences().length === 250));
    assert(Date.now() - start < 1500, '250-event catchup must not wait two polling ticks');
    for (const c of clients) assert.deepEqual(c.sequences(), Array.from({ length: 250 }, (_, i) => String(i + 1)));
    assert(maximum <= 8 && maximum > 1, `bounded concurrency expected, got ${maximum}`);
  } finally { await f.close(); }
});

test('a wake during an in-flight read is retained and drained after the snapshot', async () => {
  let reads = 0, head = 0;
  const blocked = deferred();
  const f = await fixture(async (projectId, _actor, since) => {
    reads++; const result = page(since, head, projectId);
    if (reads === 1) await blocked.promise;
    return result;
  });
  try {
    const a = await f.connect(); await until(() => reads === 1);
    head = 1; f.source.wake(); await pause(50);
    blocked.resolve(); await until(() => a.sequences().includes('1'));
    assert.equal(reads, 2); assert.deepEqual(a.sequences(), ['1']);
  } finally { blocked.resolve(); await f.close(); }
});

test('revocation after snapshot prevents delivery and close discards scheduled work', async () => {
  let allowed = true, reads = 0;
  const blocked = deferred();
  const f = await fixture(async () => { reads++; await blocked.promise; return page('0', 1); }, async () => allowed);
  try {
    const a = await f.connect(); await until(() => reads === 1);
    const closed = new Promise<number>(resolve => a.socket.once('close', resolve));
    allowed = false; f.source.wake(); blocked.resolve();
    assert.equal(await closed, 4403); assert.deepEqual(a.sequences(), []);
    await pause(50); assert.equal(reads, 1);
  } finally { blocked.resolve(); await f.close(); }
});

test('100 native room peers share exactly two frozen replay snapshots per page', { timeout: 10_000 }, async () => {
  let head = 0, active = 0;
  const batches: Array<{ projectId: string; since: string; users: number }> = [];
  const f = await fixture(async () => { throw new Error('Batch transport must not call singleton replay'); }, async () => true,
    undefined, 200, async (projectId, actors, since) => {
      active++; batches.push({ projectId, since, users: actors.length });
      try { await pause(2); return actors.map(actor => ({ userId: actor.userId, result: page(since, head, projectId) })); }
      finally { active--; }
    });
  try {
    const clients = await Promise.all(Array.from({ length: 100 }, () => f.connect()));
    await until(() => active === 0); await pause(20); batches.length = 0;
    head = 1; f.source.wake();
    await until(() => clients.every(client => client.sequences().includes('1')));
    assert.deepEqual(batches.map(batch => batch.users), [50, 50]);
    assert(batches.every(batch => batch.projectId === 'p' && batch.since === '0'));
    batches.length = 0; head = 251; f.source.wake();
    await until(() => clients.every(client => client.sequences().length === 251));
    assert.equal(batches.length, 6, 'three 100-event pages each need two room snapshots');
    assert(batches.every(batch => batch.users === 50));
    for (const client of clients) assert.deepEqual(client.sequences(), Array.from({ length: 251 }, (_, i) => String(i + 1)));
  } finally { await f.close(); }
});

test('cohort concurrency and input size are bounded across rooms without cursor mixing', { timeout: 10_000 }, async () => {
  let active = 0, maximum = 0;
  const batches: Array<{ projectId: string; since: string; users: number }> = [];
  const f = await fixture(async () => { throw new Error('No singleton reads'); }, async () => true, undefined, 200,
    async (projectId, actors, since) => {
      active++; maximum = Math.max(maximum, active); batches.push({ projectId, since, users: actors.length });
      try { await pause(10); return actors.map(actor => ({ userId: actor.userId, result: page(since, 150, projectId) })); }
      finally { active--; }
    });
  try {
    const clients = await Promise.all(Array.from({ length: 90 }, (_, i) => f.connect(i % 2 ? '50' : '0', `room${Math.floor(i / 10)}`)));
    await until(() => clients.every((client, i) => client.sequences().length === (i % 2 ? 100 : 150)));
    assert(maximum <= 8 && maximum > 1, `Expected <=8 cohort reads, got ${maximum}`);
    assert(batches.every(batch => batch.users > 0 && batch.users <= 50));
    for (const [i, client] of clients.entries()) {
      const start = i % 2 ? 51 : 1;
      assert.deepEqual(client.sequences(), Array.from({ length: 151 - start }, (_, j) => String(start + j)));
      for (const frame of client.frames.filter(frame => frame.type === 'events'))
        assert(frame.events.every(event => event.projectId === `room${Math.floor(i / 10)}`));
    }
  } finally { await f.close(); }
});

test('a late room arrival cannot join an in-flight snapshot and denied recipients do not poison peers', async () => {
  let head = 0, hold = false, entered = 0, denied = '';
  const gate = deferred(), batches: string[][] = [];
  const f = await fixture(async () => { throw new Error('No singleton reads'); }, async () => true, undefined, 200,
    async (projectId, actors, since) => {
      batches.push(actors.map(actor => actor.userId)); const snapshot = page(since, head, projectId);
      if (hold) { entered++; await gate.promise; }
      return actors.map(actor => actor.userId === denied ? { userId: actor.userId, error: new Error('Denied') } :
        { userId: actor.userId, result: snapshot });
    });
  try {
    const peers = await Promise.all([f.connect(), f.connect()]); await pause(20); batches.length = 0;
    denied = peers[0].userId; const closed = new Promise<number>(resolve => peers[0].socket.once('close', resolve));
    head = 1; hold = true; f.source.wake(); await until(() => entered === 1);
    head = 2;
    const late = await f.connect(); await until(() => entered === 2);
    assert.equal(batches[0].includes(late.userId), false);
    gate.resolve(); assert.equal(await closed, 4403);
    await until(() => late.sequences().includes('2') && peers[1].sequences().includes('1'));
    assert.deepEqual(peers[0].sequences(), []); assert.deepEqual(peers[1].sequences(), ['1']);
    assert.deepEqual(late.sequences(), ['1', '2']);
    hold = false; f.source.wake(); await until(() => peers[1].sequences().includes('2'));
  } finally { gate.resolve(); await f.close(); }
});

test('post-snapshot session validation is independent for peers sharing one room cohort', async () => {
  let head = 0, blocked = '', entered = false, hold = false;
  const gate = deferred();
  const f = await fixture(async () => { throw new Error('No singleton reads'); }, async session => session.actor.userId !== blocked,
    undefined, 200, async (projectId, actors, since) => {
      const result = page(since, head, projectId);
      if (hold) { entered = true; await gate.promise; }
      return actors.map(actor => ({ userId: actor.userId, result }));
    });
  try {
    const peers = await Promise.all([f.connect(), f.connect()]); await pause(20);
    head = 1; hold = true; f.source.wake(); await until(() => entered);
    blocked = peers[0].userId; const closed = new Promise<number>(resolve => peers[0].socket.once('close', resolve));
    gate.resolve(); assert.equal(await closed, 4403); await until(() => peers[1].sequences().includes('1'));
    assert.deepEqual(peers[0].sequences(), []); assert.deepEqual(peers[1].sequences(), ['1']);
  } finally { gate.resolve(); await f.close(); }
});
