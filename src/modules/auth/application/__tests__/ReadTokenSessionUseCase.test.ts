import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate as nextTurn, setTimeout as delay } from 'node:timers/promises';
import { ReadTokenSessionUseCase } from '../ReadTokenSessionUseCase.js';
import { SessionVerificationUnavailable, type TokenSessionReader, type TokenSessionState } from '../../domain/TokenSession.js';

const identity = { userId: 'user', jti: 'jti' };
const state = (): TokenSessionState => ({ userId: 'user', role: 'student', isActive: true, mustChangePassword: false, revoked: false });

test('100 simultaneous editor bootstraps share queued session reads without rejecting the 1800 requests', async () => {
  let identities = 0;
  const uc = new ReadTokenSessionUseCase({ async readMany(inputs) {
    identities += inputs.length;
    return inputs.map(input => ({ ...state(), userId: input.userId }));
  } });
  try {
    const rows = await Promise.all(Array.from({ length: 100 }, (_, i) =>
      Array.from({ length: 18 }, () => uc.execute({ userId: String(i), jti: `jti-${i}` }))).flat());
    assert.equal(rows.length, 1800);
    rows.forEach((row, index) => assert.equal(row?.userId, String(Math.floor(index / 18))));
    assert.equal(identities, 100);
    assert.equal(uc.snapshot().coalescedChecks, 1700);
    assert.equal(uc.snapshot().rejectedCapacity, 0);
  } finally { uc.close(); }
});

test('queued deduplication does not allow an unbounded number of waiters for one session', async () => {
  const uc = new ReadTokenSessionUseCase({ async readMany() { return [state()]; } }, { maxOutstanding: 8 });
  try {
    const admitted = Array.from({ length: 8 }, () => uc.execute(identity));
    await assert.rejects(uc.execute(identity), SessionVerificationUnavailable);
    assert.equal(uc.snapshot().outstanding, 8);
    assert.equal((await Promise.all(admitted)).length, 8);
    assert.equal(uc.snapshot().outstanding, 0);
  } finally { uc.close(); }
});

test('coalesces concurrent reads into bounded batches while keeping input order', async () => {
  const sizes: number[] = [];
  const reader: TokenSessionReader = { async readMany(inputs) {
    sizes.push(inputs.length); return inputs.map(input => ({ ...state(), userId: input.userId }));
  } };
  const uc = new ReadTokenSessionUseCase(reader, { batchSize: 3, concurrency: 2 });
  try {
    const rows = await Promise.all(Array.from({ length: 8 }, (_, i) => uc.execute({ ...identity, userId: String(i) })));
    assert.deepEqual(rows.map(row => row?.userId), Array.from({ length: 8 }, (_, i) => String(i)));
    assert.deepEqual(sizes, [3, 3, 2]);
  } finally { uc.close(); }
});

test('a request after revocation never joins a read that started before revocation', async () => {
  let revoked = false, calls = 0;
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const uc = new ReadTokenSessionUseCase({ async readMany(inputs) {
    const snapshot = revoked; calls++;
    if (calls === 1) await blocked;
    return inputs.map(() => ({ ...state(), revoked: snapshot }));
  } }, { concurrency: 1 });
  try {
    const earlier = uc.execute(identity); await nextTurn();
    revoked = true;
    const later = uc.execute(identity); release();
    assert.equal((await earlier)?.revoked, false);
    assert.equal((await later)?.revoked, true);
    assert.equal(calls, 2);
  } finally { uc.close(); }
});

test('timeouts retain a running DB slot and admission stays bounded', async () => {
  let release!: () => void, calls = 0;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const uc = new ReadTokenSessionUseCase({ async readMany() { calls++; await blocked; return [state()]; } },
    { concurrency: 1, maxOutstanding: 1, timeoutMs: 15 });
  try {
    await assert.rejects(uc.execute(identity), SessionVerificationUnavailable);
    await assert.rejects(uc.execute(identity), SessionVerificationUnavailable);
    assert.equal(calls, 1);
    release(); await nextTurn();
    assert.deepEqual(await uc.execute(identity), state());
  } finally { release(); uc.close(); }
});

test('dependency failure and shutdown fail closed without stranding pending requests', async () => {
  const failed = new ReadTokenSessionUseCase({ async readMany() { throw new Error('unavailable'); } });
  await assert.rejects(failed.execute(identity), SessionVerificationUnavailable); failed.close();
  const uc = new ReadTokenSessionUseCase({ async readMany() { await delay(10); return [state()]; } });
  const pending = assert.rejects(uc.execute(identity), SessionVerificationUnavailable);
  uc.close(); await pending;
  await assert.rejects(uc.execute(identity), SessionVerificationUnavailable);
});
