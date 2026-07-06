
import type { PrismaClient } from '../../../generated/prisma/index.js';
import type { BlobStorage } from '../../../shared/storage/BlobStorage.js';
import {
  SnapshotTooLargeError,
  type ProjectFileSnapshot,
  type ProjectFileSnapshotPort,
} from '../domain/ProjectFileSnapshotPort.js';

const DEFAULT_MAX_SNAPSHOT_BYTES = 256 * 1024 * 1024;

export interface PrismaProjectFileSnapshotAdapterOptions {
  maxBytes?: number;
}

export class PrismaProjectFileSnapshotAdapter implements ProjectFileSnapshotPort {
  private readonly maxBytes: number;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: BlobStorage,
    opts: PrismaProjectFileSnapshotAdapterOptions = {},
  ) {
    this.maxBytes = opts.maxBytes ?? DEFAULT_MAX_SNAPSHOT_BYTES;
  }

  async *listFiles(projectId: string): AsyncIterable<ProjectFileSnapshot> {
    const files = await this.prisma.file.findMany({
      where: {
        projectId,
        kind: { in: ['typst', 'bib', 'image', 'data'] },
      },
      select: {
        path: true,
        textContent: true,
        storageKey: true,
        sizeBytes: true,
      },
    });

    let bytesYielded = 0;

    for (const file of files) {
      const expected = file.sizeBytes ?? 0;
      if (bytesYielded + expected > this.maxBytes) {
        throw new SnapshotTooLargeError(bytesYielded + expected, this.maxBytes);
      }

      if (file.storageKey) {
        const stream = await this.storage.get(file.storageKey);
        const chunks: Buffer[] = [];
        let fileBytes = 0;
        try {
          for await (const chunk of stream) {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            fileBytes += buf.length;
            if (bytesYielded + fileBytes > this.maxBytes) {
              if (!stream.destroyed && typeof stream.destroy === 'function') {
                stream.destroy();
              }
              throw new SnapshotTooLargeError(
                bytesYielded + fileBytes,
                this.maxBytes,
              );
            }
            chunks.push(buf);
          }
        } catch (err) {
          if (!stream.destroyed && typeof stream.destroy === 'function') {
            stream.destroy();
          }
          throw err;
        }
        bytesYielded += fileBytes;
        yield { path: file.path, content: Buffer.concat(chunks) };
      } else {
        const content = file.textContent ?? '';
        const textBytes = Buffer.byteLength(content, 'utf8');
        if (bytesYielded + textBytes > this.maxBytes) {
          throw new SnapshotTooLargeError(
            bytesYielded + textBytes,
            this.maxBytes,
          );
        }
        bytesYielded += textBytes;
        yield { path: file.path, content };
      }
    }
  }
}
