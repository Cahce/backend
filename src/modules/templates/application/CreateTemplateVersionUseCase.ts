/**
 * Create Template Version Use Case
 * 
 * Application layer orchestration for creating a new template version.
 * Handles file upload and storage.
 */

import type { TemplateRepo, TemplateStorageGateway } from '../domain/Ports.js';
import type { TemplateVersion } from '../domain/Types.js';
import { TemplateErrors } from '../domain/Errors.js';

export type CreateTemplateVersionInput = {
  templateId: string;
  versionNumber: string;
  changelog: string | null;
  archive: AsyncIterable<Buffer>;
  archiveType: 'typ' | 'zip';
};

export type CreateTemplateVersionResult =
  | { success: true; data: TemplateVersion }
  | { success: false; error: { code: string; message: string } };

/**
 * Use case for creating a new template version
 */
export class CreateTemplateVersionUseCase {
  constructor(
    private readonly templateRepo: TemplateRepo,
    private readonly storage: TemplateStorageGateway,
  ) {}

  async execute(input: CreateTemplateVersionInput): Promise<CreateTemplateVersionResult> {
    try {
      // Validate template exists
      const template = await this.templateRepo.findById(input.templateId);
      if (!template) {
        return {
          success: false,
          error: TemplateErrors.TEMPLATE_NOT_FOUND,
        };
      }

      // Validate version number format (basic regex)
      const versionRegex = /^v?\d+\.\d+\.\d+$/;
      if (!versionRegex.test(input.versionNumber)) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Số phiên bản không hợp lệ (định dạng: v1.0.0 hoặc 1.0.0)',
          },
        };
      }

      // Generate temporary version ID for storage
      const tempVersionId = `temp-${Date.now()}`;

      // Write to storage first
      let storageResult: { storageKey: string; fileCount: number; entryPath: string };
      try {
        storageResult = await this.storage.writeArchive({
          templateId: input.templateId,
          versionId: tempVersionId,
          archive: input.archive,
          archiveType: input.archiveType,
        });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'FILE_TOO_LARGE') {
            return {
              success: false,
              error: TemplateErrors.FILE_TOO_LARGE,
            };
          }
          if (error.message === 'INVALID_ARCHIVE') {
            return {
              success: false,
              error: TemplateErrors.INVALID_ARCHIVE,
            };
          }
        }
        throw error;
      }

      // Create version in database
      try {
        const version = await this.templateRepo.createVersion({
          templateId: input.templateId,
          versionNumber: input.versionNumber,
          changelog: input.changelog,
          storageKey: storageResult.storageKey,
          entryPath: storageResult.entryPath,
        });

        // Return the version as persisted. (storageKey is the temp-prefixed key
        // actually written to disk + DB; the earlier `newStorageKey` override
        // returned a path that disagreed with both and was never consumed.)
        return {
          success: true,
          data: version,
        };
      } catch (error) {
        // Rollback storage on database error
        await this.storage.remove(storageResult.storageKey);

        if (error instanceof Error && error.message === 'VERSION_EXISTS') {
          return {
            success: false,
            error: TemplateErrors.VERSION_EXISTS,
          };
        }

        throw error;
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Lỗi hệ thống',
        },
      };
    }
  }
}
