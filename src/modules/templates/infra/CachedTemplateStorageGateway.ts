
import { LRUCache } from 'lru-cache';
import type { TemplateStorageGateway } from '../domain/Ports.js';
import type { MaterializedFile } from '../domain/Types.js';

export interface CachedTemplateStorageGatewayOptions {
  maxEntries?: number;
  maxBytes?: number;
}

function estimateFilesSize(files: MaterializedFile[]): number {
  let total = 0;
  for (const f of files) {
    total += f.path.length;
    total += f.content.length * 2;
    total += f.data?.length ?? 0;
    total += 32;
  }
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
    });
  }

  async writeArchive(
    input: Parameters<TemplateStorageGateway['writeArchive']>[0],
  ): ReturnType<TemplateStorageGateway['writeArchive']> {
    return this.inner.writeArchive(input);
  }

  async writeFiles(
    input: Parameters<TemplateStorageGateway['writeFiles']>[0],
  ): ReturnType<TemplateStorageGateway['writeFiles']> {
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
    return this.inner.readArchive(storageKey);
  }

  async remove(storageKey: string): Promise<void> {
    await this.inner.remove(storageKey);
    this.cache.delete(storageKey);
  }
}
