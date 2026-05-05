/**
 * Prisma adapter for ProjectFileSnapshotPort
 *
 * Reuses prisma.file.findMany filtered by projectId.
 * Text files are returned as-is from the inline textContent column.
 * Binary files (image/data) with a storageKey are streamed from BlobStorage.
 */

import type { PrismaClient } from '../../../generated/prisma/index.js';
import type { BlobStorage } from '../../../shared/storage/BlobStorage.js';
import type { ProjectFileSnapshotPort, ProjectFileSnapshot } from '../domain/ProjectFileSnapshotPort.js';

export class PrismaProjectFileSnapshotAdapter implements ProjectFileSnapshotPort {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: BlobStorage,
  ) {}

  async listFiles(projectId: string): Promise<ProjectFileSnapshot[]> {
    const files = await this.prisma.file.findMany({
      where: {
        projectId,
        kind: {
          in: ['typst', 'bib', 'image', 'data'],
        },
      },
      select: {
        path: true,
        textContent: true,
        storageKey: true,
      },
    });

    return Promise.all(
      files.map(async (file): Promise<ProjectFileSnapshot> => {
        if (file.storageKey) {
          const stream = await this.storage.get(file.storageKey);
          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          return { path: file.path, content: Buffer.concat(chunks) };
        }
        return { path: file.path, content: file.textContent ?? '' };
      }),
    );
  }
}
