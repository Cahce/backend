/**
 * LRU-cached decorator for `TemplateStorageGateway`.
 *
 * `readFiles(storageKey)` is hot: it fires every time a project is created
 * from a template, and reads many text files from disk. Because template
 * versions are content-addressed via their `storageKey` (immutable for the
 * lifetime of the version row), the result is safe to cache aggressively.
 *
 * Bounded memory: size-aware LRU caps total bytes (default 100 MB) and
 * entries (default 50). The wrapper preserves the inner port semantics for
 * write/read-archive/remove, and proactively invalidates the cache on
 * `remove()` so stale content never resurrects after a version is deleted.
 */

import { LRUCache } from 'lru-cache';
import type { TemplateStorageGateway } from '../domain/Ports.js';
import type { MaterializedFile } from '../domain/Types.js';

export interface CachedTemplateStorageGatewayOptions {
  /** Tối đa số entry. Mặc định 50. */
  maxEntries?: number;
  /** Tối đa tổng byte content gộp lại. Mặc định 100 MB. */
  maxBytes?: number;
}

function estimateFilesSize(files: MaterializedFile[]): number {
  let total = 0;
  for (const f of files) {
    total += f.path.length;
    // V8 strings ~2 byte / char (UTF-16). Approximate is good enough for LRU.
    total += f.content.length * 2;
    total += 32; // object overhead
  }
  // LRU's sizeCalculation must return >0; fall back to 1 if empty.
  return total || 1;
}

export class CachedTemplateStorageGateway implements TemplateStorageGateway {
  private readonly cache: LRUCache<string, MaterializedFile[]>;

  constructor(
    private readonly inner: TemplateStorageGateway,
    opts: CachedTemplateStorageGatewayOptions = {},
  ) {
    this.cache = new LRUCache<string, MaterializedFile[]>({
      max: opts.maxEntries ?? 50,
      maxSize: opts.maxBytes ?? 100 * 1024 * 1024,
      sizeCalculation: estimateFilesSize,
      // No TTL: storageKey is content-addressed, so cached value remains
      // correct until the version is removed (handled below).
    });
  }

  async writeArchive(
    input: Parameters<TemplateStorageGateway['writeArchive']>[0],
  ): ReturnType<TemplateStorageGateway['writeArchive']> {
    // New version gets a fresh storageKey — nothing to invalidate on the
    // existing cache. Just delegate.
    return this.inner.writeArchive(input);
  }

  async writeFiles(
    input: Parameters<TemplateStorageGateway['writeFiles']>[0],
  ): ReturnType<TemplateStorageGateway['writeFiles']> {
    // Like writeArchive: a published version writes to a fresh storageKey, so
    // there's nothing cached to invalidate. Just delegate.
    return this.inner.writeFiles(input);
  }

  async readFiles(storageKey: string): Promise<MaterializedFile[]> {
    const cached = this.cache.get(storageKey);
    if (cached) {
      return cached;
    }
    const files = await this.inner.readFiles(storageKey);
    this.cache.set(storageKey, files);
    return files;
  }

  async readArchive(storageKey: string): Promise<Buffer> {
    // Archive bytes can be very large; not worth caching here.
    return this.inner.readArchive(storageKey);
  }

  async remove(storageKey: string): Promise<void> {
    await this.inner.remove(storageKey);
    this.cache.delete(storageKey);
  }
}
