import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { ReadinessMonitor } from '../ReadinessMonitor.js';

test('readiness requires a successful recent probe and goes false on stop', async () => {
  const monitor = new ReadinessMonitor({ async check() {} }, { intervalMs: 1000, timeoutMs: 20, maxAgeMs: 30 });
  assert.equal(monitor.ready, false);
  monitor.start();
  await delay(1); assert.equal(monitor.ready, true);
  await delay(40); assert.equal(monitor.ready, false, 'stale cached health must not remain ready');
  monitor.stop(); assert.equal(monitor.ready, false);
});

test('a timed-out dependency cannot cause overlapping probe queries or late readiness', async () => {
  let release!: () => void, calls = 0;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const monitor = new ReadinessMonitor({ async check() { calls++; await blocked; } },
    { intervalMs: 5, timeoutMs: 5, maxAgeMs: 30 });
  monitor.start();
  await delay(25);
  assert.equal(monitor.ready, false); assert.equal(calls, 1);
  monitor.stop(); release(); await delay(1);
  assert.equal(monitor.ready, false);
});

test('dependency recovery is observed without restarting the server', async () => {
  let failing = true;
  const monitor = new ReadinessMonitor({ async check() { if (failing) throw new Error('down'); } },
    { intervalMs: 5, timeoutMs: 20 });
  try {
    monitor.start(); await delay(1); assert.equal(monitor.ready, false);
    failing = false; await delay(20); assert.equal(monitor.ready, true);
  } finally { monitor.stop(); }
});
