/**
 * Prisma adapter for ProjectFileSnapshotPort
 *
 * Reuses prisma.file.findMany filtered by projectId. Text files are returned
 * as-is from the inline textContent column. Binary files (image/data) with a
 * storageKey are streamed from BlobStorage.
 *
 * Streaming + bounded: emits files one at a time via async generator and
 * tracks cumulative bytes against `MAX_SNAPSHOT_BYTES`. The previous
 * implementation buffered every file content into a `Buffer.concat` array
 * before returning, which scaled linearly with project size — a 1 GB project
 * would happily OOM a 512 MB container. With this adapter, the upper bound is
 * always the configured limit (default 256 MB) regardless of project size.
 */

import type { PrismaClient } from '../../../generated/prisma/index.js';
import type { BlobStorage } from '../../../shared/storage/BlobStorage.js';
import {
  SnapshotTooLargeError,
  type ProjectFileSnapshot,
  type ProjectFileSnapshotPort,
} from '../domain/ProjectFileSnapshotPort.js';

const DEFAULT_MAX_SNAPSHOT_BYTES = 256 * 1024 * 1024; // 256 MB

export interface PrismaProjectFileSnapshotAdapterOptions {
  /** Hard byte ceiling for the cumulative snapshot. */
  maxBytes?: number;
}

export class PrismaProjectFileSnapshotAdapter implements ProjectFileSnapshotPort {
  private readonly maxBytes: number;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: BlobStorage,
    opts: PrismaProjectFileSnapshotAdapterOptions = {},
  ) {
    // Env is read only in src/config; the limit is injected via opts from the
    // composition root (app.config.compile.maxSnapshotBytes).
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
      // Pre-flight check using metadata if available — fail fast before any
      // disk/blob read when we already know the snapshot is going to blow
      // the budget. `sizeBytes` may be null for legacy rows; treat as 0 so
      // the in-loop counter below catches the overflow.
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
            // In-flight check: the actual stream may exceed metadata size
            // (or metadata may be unset). Destroy the source on overflow.
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
          // Always ensure the source is destroyed on error to avoid leaking
          // file descriptors. SnapshotTooLargeError is already thrown above
          // and re-thrown here.
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
