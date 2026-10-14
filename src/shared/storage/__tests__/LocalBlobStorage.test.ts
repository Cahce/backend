import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { LocalBlobStorage } from '../LocalBlobStorage.js';

let rootDir: string;
let storage: LocalBlobStorage;

before(async () => {
  rootDir = await mkdtemp(join(tmpdir(), 'blob-test-'));
  storage = new LocalBlobStorage(rootDir);
});

after(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

describe('LocalBlobStorage', () => {
  it('round-trips a 5KB buffer and returns stable sha256', async () => {
    const buf = Buffer.alloc(5 * 1024, 0xab);
    const expectedSha = createHash('sha256').update(buf).digest('hex');

    const meta = await storage.put('key-5kb', buf, 'application/octet-stream');

    assert.equal(meta.sizeBytes, 5 * 1024);
    assert.equal(meta.sha256, expectedSha);
    assert.equal(meta.contentType, 'application/octet-stream');

    const meta2 = await storage.put('key-5kb-dup', buf, 'application/octet-stream');
    assert.equal(meta2.sha256, expectedSha);
  });

  it('head() after put() returns same metadata', async () => {
    const buf = Buffer.from('hello storage');
    const putMeta = await storage.put('key-head', buf, 'text/plain');
    const headMeta = await storage.head('key-head');

    assert.deepEqual(headMeta, putMeta);
  });

  it('head() returns null for missing key', async () => {
    const result = await storage.head('key-nonexistent');
    assert.equal(result, null);
  });

  it('get() returns a readable stream with correct content', async () => {
    const content = Buffer.from('stream content test');
    await storage.put('key-get', content, 'text/plain');

    const stream = await storage.get('key-get');
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const result = Buffer.concat(chunks);
    assert.deepEqual(result, content);
  });

  it('delete() removes blob and metadata', async () => {
    const buf = Buffer.from('to be deleted');
    await storage.put('key-delete', buf, 'text/plain');

    await storage.delete('key-delete');

    const meta = await storage.head('key-delete');
    assert.equal(meta, null);
  });

  it('get() rejects with STORAGE_NOT_FOUND when the blob file is missing but metadata exists', async () => {
    const key = 'key-orphan-meta';
    await storage.put(key, Buffer.from('soon to be orphaned'), 'text/plain');

    // Delete only the .bin payload, keeping the .json metadata (orphaned meta).
    await unlink(join(rootDir, key.slice(0, 2), `${key}.bin`));

    const meta = await storage.head(key);
    assert.ok(meta, 'metadata must still exist');

    await assert.rejects(
      () => storage.get(key),
      (error: unknown) =>
        error instanceof Error &&
        (error as Error & { code?: string }).code === 'STORAGE_NOT_FOUND',
    );
  });

  it('put() is idempotent for the same key', async () => {
    const buf1 = Buffer.from('version 1');
    const buf2 = Buffer.from('version 2');

    await storage.put('key-idempotent', buf1, 'text/plain');
    const meta2 = await storage.put('key-idempotent', buf2, 'text/plain');
    const headMeta = await storage.head('key-idempotent');

    assert.equal(meta2.sha256, headMeta!.sha256);
  });
});
