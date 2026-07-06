
import { createHash, randomUUID } from 'node:crypto';

import type { ProjectRepo } from '../domain/Project/Ports.js';
import type { Project } from '../domain/Project/Types.js';
import type { FileRepo } from '../../project-files/domain/ProjectFile/Ports.js';
import { StorageMode } from '../../project-files/domain/ProjectFile/Types.js';
import type { BlobStorage } from '../../../shared/storage/BlobStorage.js';
import type { ProjectAccessPolicy } from '../domain/access/ProjectAccessPolicies.js';
import { ProjectErrors } from '../domain/Project/Errors.js';
import { ProjectSettings } from '../domain/ProjectSettings.js';
import type { ProjectSettingsRepository } from '../domain/ProjectSettingsRepository.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';

export interface DuplicateProjectCommand {
  projectId: string;
  userId: string;
  title?: string;
}

export interface DuplicateProjectResult {
  project: Project;
}

export class DuplicateProjectUseCase {
  constructor(
    private readonly projectRepo: ProjectRepo,
    private readonly fileRepo: FileRepo,
    private readonly projectAccess: ProjectAccessPolicy,
    private readonly blobStorage: BlobStorage,
    private readonly settingsRepo: ProjectSettingsRepository,
  ) {}

  async execute(
    command: DuplicateProjectCommand,
  ): Promise<Result<DuplicateProjectResult>> {
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

    const source = await this.projectRepo.findById(command.projectId);
    if (!source) {
      return failure(
        ProjectErrors.PROJECT_NOT_FOUND.code,
        ProjectErrors.PROJECT_NOT_FOUND.message,
      );
    }

    const title = command.title?.trim() || `${source.title} (Bản sao)`;

    let project: Project;
    try {
      project = await this.projectRepo.create({
        title,
        category: source.category,
        ownerId: command.userId,
        templateId: source.templateId,
        templateVersionId: source.templateVersionId,
      });
    } catch (err) {
      console.error('[DuplicateProject] failed to create project:', err);
      return failure('INTERNAL_ERROR', 'Không thể tạo bản sao dự án');
    }

    try {
      const files = await this.fileRepo.listByProjectId(command.projectId);

      for (const file of files) {
        if (file.storageMode === StorageMode.Inline) {
          const content = file.textContent ?? '';
          const sha256 = createHash('sha256').update(content).digest('hex');
          await this.fileRepo.create({
            projectId: project.id,
            path: file.path,
            kind: file.kind,
            content,
            storageMode: StorageMode.Inline,
            sizeBytes: Buffer.byteLength(content, 'utf-8'),
            sha256,
          });
        } else if (
          file.storageMode === StorageMode.ObjectStorage &&
          file.storageKey
        ) {
          let srcStream;
          try {
            srcStream = await this.blobStorage.get(file.storageKey);
          } catch (err) {
            console.warn(
              `[DuplicateProject] missing blob ${file.storageKey} for ${file.path}, skipping:`,
              err,
            );
            continue;
          }
          const newKey = `projects/${project.id}/${randomUUID()}-${file.path
            .split('/')
            .pop()}`;
          const meta = await this.blobStorage.put(
            newKey,
            srcStream,
            file.mimeType ?? 'application/octet-stream',
          );
          await this.fileRepo.createBinary({
            projectId: project.id,
            path: file.path,
            kind: file.kind,
            storageKey: newKey,
            mimeType: meta.contentType,
            sizeBytes: meta.sizeBytes,
            sha256: meta.sha256,
          });
        }
      }

      const srcSettings = await this.settingsRepo.findOrCreate(command.projectId);
      const newSettings = await this.settingsRepo.findOrCreate(project.id);
      await this.settingsRepo.update(
        new ProjectSettings(
          newSettings.projectId,
          srcSettings.mainPath,
          srcSettings.compileOptions,
          srcSettings.zoteroConfig,
          srcSettings.openalexConfig,
          new Date(),
        ),
      );
    } catch (err) {
      console.error('[DuplicateProject] failed mid-copy:', err);
      return failure(
        'INTERNAL_ERROR',
        'Lỗi khi sao chép dự án. Bản sao có thể đã được tạo nhưng thiếu file; vui lòng xóa và thử lại.',
      );
    }

    return success({ project });
  }
}
