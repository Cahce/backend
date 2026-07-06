
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

export class CreateTemplateVersionUseCase {
  constructor(
    private readonly templateRepo: TemplateRepo,
    private readonly storage: TemplateStorageGateway,
  ) {}

  async execute(input: CreateTemplateVersionInput): Promise<CreateTemplateVersionResult> {
    try {
      const template = await this.templateRepo.findById(input.templateId);
      if (!template) {
        return {
          success: false,
          error: TemplateErrors.TEMPLATE_NOT_FOUND,
        };
      }

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

      const tempVersionId = `temp-${Date.now()}`;

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

      try {
        const version = await this.templateRepo.createVersion({
          templateId: input.templateId,
          versionNumber: input.versionNumber,
          changelog: input.changelog,
          storageKey: storageResult.storageKey,
          entryPath: storageResult.entryPath,
        });

        return {
          success: true,
          data: version,
        };
      } catch (error) {
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
