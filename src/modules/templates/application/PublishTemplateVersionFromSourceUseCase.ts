/**
 * Publish Template Version From Source Use Case
 *
 * Snapshots the current text files of a template's source project into a new
 * immutable `TemplateVersion`. Mirrors `CreateTemplateVersionUseCase`'s
 * write-then-create + rollback flow, but reads files from the source project
 * (via `SourceProjectGateway`) instead of an uploaded archive.
 */

import type {
  SourceProjectGateway,
  TemplateRepo,
  TemplateStorageGateway,
} from '../domain/Ports.js';
import type { TemplateVersion } from '../domain/Types.js';
import { TemplateErrors } from '../domain/Errors.js';

export type PublishTemplateVersionFromSourceInput = {
  templateId: string;
  versionNumber: string;
  changelog: string | null;
};

export type PublishTemplateVersionFromSourceResult =
  | { success: true; data: TemplateVersion }
  | { success: false; error: { code: string; message: string } };

const VERSION_REGEX = /^v?\d+\.\d+\.\d+$/;

export class PublishTemplateVersionFromSourceUseCase {
  constructor(
    private readonly templateRepo: TemplateRepo,
    private readonly storage: TemplateStorageGateway,
    private readonly sourceProjects: SourceProjectGateway,
  ) {}

  async execute(
    input: PublishTemplateVersionFromSourceInput,
  ): Promise<PublishTemplateVersionFromSourceResult> {
    try {
      if (!VERSION_REGEX.test(input.versionNumber)) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Số phiên bản không hợp lệ (định dạng: v1.0.0 hoặc 1.0.0)',
          },
        };
      }

      const template = await this.templateRepo.findById(input.templateId);
      if (!template) {
        return { success: false, error: TemplateErrors.TEMPLATE_NOT_FOUND };
      }
      if (!template.sourceProjectId) {
        return { success: false, error: TemplateErrors.SOURCE_PROJECT_MISSING };
      }

      const { files, entryPath } =
        await this.sourceProjects.readSourceProjectFiles(template.sourceProjectId);

      if (files.length === 0 || !files.some((f) => f.path === entryPath)) {
        // Nothing to publish, or the entry file is missing/binary-only.
        return { success: false, error: TemplateErrors.INVALID_ARCHIVE };
      }

      // Random suffix avoids same-millisecond collisions when two publishes
      // race (Date.now() alone is not unique enough under concurrency).
      const tempVersionId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      let storageResult: { storageKey: string; fileCount: number; entryPath: string };
      try {
        storageResult = await this.storage.writeFiles({
          templateId: input.templateId,
          versionId: tempVersionId,
          files,
          entryPath,
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'INVALID_ARCHIVE') {
          return { success: false, error: TemplateErrors.INVALID_ARCHIVE };
        }
        throw error;
      }

      try {
        const version = await this.templateRepo.createVersion({
          templateId: input.templateId,
          versionNumber: input.versionNumber,
          changelog: input.changelog,
          storageKey: storageResult.storageKey,
          entryPath: storageResult.entryPath,
        });
        return { success: true, data: version };
      } catch (error) {
        // Roll back the just-written storage on DB failure.
        await this.storage.remove(storageResult.storageKey);
        if (error instanceof Error && error.message === 'VERSION_EXISTS') {
          return { success: false, error: TemplateErrors.VERSION_EXISTS };
        }
        throw error;
      }
    } catch (error) {
      console.error('[PublishTemplateVersionFromSource] error:', error);
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống' },
      };
    }
  }
}
