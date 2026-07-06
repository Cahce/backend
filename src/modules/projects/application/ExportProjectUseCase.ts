
import archiver from 'archiver';
import type { Readable } from 'node:stream';

import type { ProjectRepo } from '../domain/Project/Ports.js';
import type { FileRepo } from '../../project-files/domain/ProjectFile/Ports.js';
import { StorageMode } from '../../project-files/domain/ProjectFile/Types.js';
import type { BlobStorage } from '../../../shared/storage/BlobStorage.js';
import type { ProjectAccessPolicy } from '../domain/access/ProjectAccessPolicies.js';
import { ProjectErrors } from '../domain/Project/Errors.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';

export interface ExportProjectCommand {
  projectId: string;
  userId: string;
}

export interface ExportProjectResult {
  filename: string;
  stream: Readable;
}

function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[^\p{L}\p{N}\- _]+/gu, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return (cleaned || 'project').slice(0, 80);
}

function todayStamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export class ExportProjectUseCase {
  constructor(
    private readonly projectRepo: ProjectRepo,
    private readonly fileRepo: FileRepo,
    private readonly projectAccess: ProjectAccessPolicy,
    private readonly blobStorage: BlobStorage,
  ) {}

  async execute(
    command: ExportProjectCommand,
  ): Promise<Result<ExportProjectResult>> {
    try {
      try {
        await this.projectAccess.requireProjectAccess(
          command.projectId,
          command.userId,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('PROJECT_NOT_FOUND')) {
          return failure(
            ProjectErrors.PROJECT_NOT_FOUND.code,
            ProjectErrors.PROJECT_NOT_FOUND.message,
          );
        }
        return failure(
          ProjectErrors.UNAUTHORIZED.code,
          ProjectErrors.UNAUTHORIZED.message,
        );
      }

      const project = await this.projectRepo.findById(command.projectId);
      if (!project) {
        return failure(
          ProjectErrors.PROJECT_NOT_FOUND.code,
          ProjectErrors.PROJECT_NOT_FOUND.message,
        );
      }

      const files = await this.fileRepo.listByProjectId(command.projectId);
      const blobStorage = this.blobStorage;

      const archive = archiver('zip', { zlib: { level: 6 } });

      archive.on('warning', (err) => {
        // eslint-disable-next-line no-console
        console.warn('[ExportProject] archive warning:', err);
      });
      archive.on('error', (err) => {
        // eslint-disable-next-line no-console
        console.error('[ExportProject] archive error:', err);
      });

      queueMicrotask(async () => {
        try {
          for (const file of files) {
            if (file.storageMode === StorageMode.Inline) {
              archive.append(file.textContent ?? '', { name: file.path });
            } else if (
              file.storageMode === StorageMode.ObjectStorage &&
              file.storageKey
            ) {
              try {
                const stream = await blobStorage.get(file.storageKey);
                archive.append(stream, { name: file.path });
              } catch (err) {
                // eslint-disable-next-line no-console
                console.warn(
                  `[ExportProject] missing blob ${file.storageKey} for ${file.path}:`,
                  err,
                );
                archive.append(
                  `// Missing binary content for ${file.path}\n`,
                  { name: file.path },
                );
              }
            } else {
              archive.append('', { name: file.path });
            }
          }
          await archive.finalize();
        } catch (err) {
          archive.destroy(err as Error);
        }
      });

      const filename = `${sanitizeFilename(project.title)}-${todayStamp()}.zip`;
      return success({ filename, stream: archive });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ExportProject] unexpected error:', err);
      return failure('INTERNAL_ERROR', 'Lỗi khi xuất dự án');
    }
  }
}
