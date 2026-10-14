import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { PasswordWorkAdmission } from '../PasswordWorkAdmission.js';
import { PasswordWorkUnavailable } from '../../domain/PasswordWorkUnavailable.js';

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}

test('concurrency/outstanding are bounded, FIFO runs after success or failure, and slot is released before return', async () => {
    const gate = new PasswordWorkAdmission({ concurrency: 2, maxOutstanding: 4, queueWaitMs: 1000 });
    const a = deferred<void>(), b = deferred<void>();
    const order: number[] = [];
    const work = (id: number, pending: Promise<void>) => gate.run(async () => { order.push(id); await pending; return id; });
    const first = work(1, a.promise), second = work(2, b.promise);
    const third = gate.run(async () => { order.push(3); throw new Error('work failed'); });
    const thirdFailure = assert.rejects(third, /work failed/);
    const fourth = work(4, Promise.resolve());
    await assert.rejects(work(5, Promise.resolve()), PasswordWorkUnavailable);
    assert.deepEqual(order, [1, 2]);
    a.resolve();
    await Promise.all([first, thirdFailure, fourth]);
    assert.deepEqual(order, [1, 2, 3, 4]);
    assert.equal(gate.snapshot().running, 1);
    b.resolve(); await second;
    assert.equal(gate.snapshot().running, 0);
    assert.equal(gate.snapshot().queued, 0);
    gate.close();
});

test('queue deadline rejects without executing; active work remains counted until real completion', async () => {
    const gate = new PasswordWorkAdmission({ concurrency: 1, maxOutstanding: 2, queueWaitMs: 20 });
    const active = deferred<number>();
    const first = gate.run(() => active.promise);
    let calls = 0;
    const waiting = assert.rejects(gate.run(async () => ++calls), PasswordWorkUnavailable);
    await delay(40); await waiting;
    assert.equal(calls, 0);
    assert.equal(gate.snapshot().running, 1);
    assert.equal(gate.snapshot().expired, 1);
    active.resolve(7); assert.equal(await first, 7);
    assert.equal(gate.snapshot().running, 0);
    gate.close();
});

test('monotonic deadline prevents work starting when the timeout callback has not fired', async () => {
    let now = 0;
    const gate = new PasswordWorkAdmission({ concurrency: 1, maxOutstanding: 2, queueWaitMs: 1000 }, () => now);
    const active = deferred<void>();
    const first = gate.run(() => active.promise);
    let ran = false;
    const waiting = assert.rejects(gate.run(async () => { ran = true; }), PasswordWorkUnavailable);
    now = 1001; active.resolve();
    await Promise.all([first, waiting]);
    assert.equal(ran, false);
    gate.close();
});

test('disconnect removes queued work but never releases an active mutation slot', async () => {
    const gate = new PasswordWorkAdmission({ concurrency: 1, maxOutstanding: 2, queueWaitMs: 1000 });
    const active = deferred<void>(), activeSignal = new AbortController(), queuedSignal = new AbortController();
    const first = gate.run(() => active.promise, activeSignal.signal);
    const waiting = assert.rejects(gate.run(async () => assert.fail('cancelled work started'), queuedSignal.signal), PasswordWorkUnavailable);
    queuedSignal.abort(); activeSignal.abort(); await waiting;
    assert.equal(gate.snapshot().queued, 0);
    assert.equal(gate.snapshot().running, 1);
    const next = gate.run(async () => 42);
    active.resolve(); await first; assert.equal(await next, 42);
    await assert.rejects(gate.run(async () => assert.fail('pre-aborted started'), queuedSignal.signal), PasswordWorkUnavailable);
    gate.close();
});

test('close rejects queued/new work and lets active work settle without reviving queue', async () => {
    const gate = new PasswordWorkAdmission({ concurrency: 1, maxOutstanding: 3, queueWaitMs: 1000 });
    const active = deferred<void>();
    const first = gate.run(() => active.promise);
    const queued = [1, 2].map(() => assert.rejects(gate.run(async () => assert.fail('closed queue started')), PasswordWorkUnavailable));
    gate.close(); gate.close(); await Promise.all(queued);
    assert.equal(gate.snapshot().running, 1);
    assert.equal(gate.snapshot().queued, 0);
    await assert.rejects(gate.run(async () => 0), PasswordWorkUnavailable);
    active.resolve(); await first;
    assert.equal(gate.snapshot().running, 0);
});
