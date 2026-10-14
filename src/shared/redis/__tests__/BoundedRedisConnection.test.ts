import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { createServer, type Socket } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { BoundedRedisConnection, SharedStateUnavailable } from '../BoundedRedisConnection.js';

class Client extends EventEmitter {
  isReady = false;
  destroyed = 0;
  connectWork: () => Promise<unknown> = async () => { this.isReady = true; };
  sendWork: (args: readonly string[]) => Promise<unknown> = async () => 'PONG';
  connect() { return this.connectWork(); }
  sendCommand(args: readonly string[]) { return this.sendWork(args); }
  destroy() { this.destroyed++; this.isReady = false; this.emit('end'); }
}
const options = { url: 'redis://localhost:6379', commandTimeoutMs: 30, connectTimeoutMs: 30, maxPending: 2 };

test('offline rejects immediately; command deadline destroys the socket and rejects all outstanding work', async () => {
  const client = new Client(), redis = new BoundedRedisConnection(options, () => client);
  await assert.rejects(redis.command(['PING']), SharedStateUnavailable);
  await redis.start();
  client.sendWork = () => new Promise(() => {});
  const pending = Promise.allSettled([redis.command(['PING']), redis.command(['PING'])]);
  await assert.rejects(redis.command(['PING']), SharedStateUnavailable);
  assert.equal(redis.snapshot().pending, 2);
  const results = await pending;
  assert.equal(results.filter(r => r.status === 'rejected').length, 2);
  assert.equal(client.destroyed, 1);
  assert.equal(redis.isReady, false);
  assert.equal(redis.snapshot().pending, 0);
  assert.equal(redis.snapshot().timeouts, 1);
  redis.stop();
});

test('connect/auth handshake has a deadline; stop cancels outstanding work and reconnect timers', async () => {
  const client = new Client(); client.connectWork = () => new Promise(() => {});
  const redis = new BoundedRedisConnection(options, () => client);
  await redis.start();
  assert.equal(client.destroyed, 1); assert.equal(redis.isReady, false);
  redis.stop();
  await delay(550);
  assert.equal(redis.snapshot().attempts, 1);

  const healthy = new Client(), second = new BoundedRedisConnection(options, () => healthy);
  await second.start(); healthy.sendWork = () => new Promise(() => {});
  const rejected = assert.rejects(second.command(['PING']), SharedStateUnavailable);
  second.stop(); second.stop(); await rejected;
  assert.equal(healthy.destroyed, 1); assert.equal(second.snapshot().pending, 0);
});

test('network failure reconnects a fresh generation without replaying an ambiguous command', async () => {
  const clients: Client[] = [];
  const redis = new BoundedRedisConnection(options, () => { const client = new Client(); clients.push(client); return client; });
  try {
    await redis.start();
    let sent = 0;
    clients[0].sendWork = () => { sent++; return new Promise(() => {}); };
    const rejected = assert.rejects(redis.command(['EVAL', 'consume']), SharedStateUnavailable);
    clients[0].emit('error', new Error('private credentials'));
    await rejected;
    for (let i = 0; i < 60 && !redis.isReady; i++) await delay(10);
    assert.equal(redis.isReady, true); assert.equal(clients.length, 2); assert.equal(sent, 1);
    assert.equal(await redis.command(['PING']), 'PONG');
  } finally { redis.stop(); }
});

test('late replies cannot succeed after deadline; command errors are sanitized', async () => {
  const client = new Client(), redis = new BoundedRedisConnection(options, () => client);
  await redis.start();
  client.sendWork = async () => { throw new Error('secret redis URL and payload'); };
  await assert.rejects(redis.command(['PING']), error => error instanceof SharedStateUnavailable && !error.message.includes('secret'));
  let late: ((value: unknown) => void) | undefined;
  client.sendWork = () => new Promise(resolve => { late = resolve; });
  await assert.rejects(redis.command(['PING']), SharedStateUnavailable);
  late?.('PONG'); await delay(1);
  assert.equal(redis.snapshot().completed, 0);
  redis.stop();
});

test('real node-redis client releases a TCP connection whose server stalls during handshake', async () => {
  const sockets = new Set<Socket>();
  const server = createServer(socket => { sockets.add(socket); socket.on('data', () => {}); socket.on('close', () => sockets.delete(socket)); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  const redis = new BoundedRedisConnection({ ...options, url: `redis://127.0.0.1:${address.port}`, connectTimeoutMs: 100 });
  try {
    await redis.start();
    assert.equal(redis.isReady, false);
    assert.equal(redis.snapshot().attempts, 1);
    assert.equal(redis.snapshot().timeouts, 1);
    for (let i = 0; i < 20 && sockets.size; i++) await delay(10);
    assert.equal(sockets.size, 0, 'underlying TCP socket must be destroyed, not just the caller promise');
  } finally {
    redis.stop(); for (const socket of sockets) socket.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
