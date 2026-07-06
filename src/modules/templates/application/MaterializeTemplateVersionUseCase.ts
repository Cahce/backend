
import type { TemplateRepo, TemplateStorageGateway } from '../domain/Ports.js';
import type { MaterializedFile } from '../domain/Types.js';
import { TemplateErrors } from '../domain/Errors.js';

export type MaterializeTemplateVersionResult =
  | { success: true; data: { files: MaterializedFile[]; entryPath: string } }
  | { success: false; error: { code: string; message: string } };

export class MaterializeTemplateVersionUseCase {
  constructor(
    private readonly templateRepo: TemplateRepo,
    private readonly storage: TemplateStorageGateway,
  ) {}

  async execute(versionId: string): Promise<MaterializeTemplateVersionResult> {
    try {
      const version = await this.templateRepo.findVersionById(versionId);
      if (!version) {
        return {
          success: false,
          error: TemplateErrors.INVALID_TEMPLATE_VERSION,
        };
      }

      if (!version.isActive) {
        return {
          success: false,
          error: TemplateErrors.INVALID_TEMPLATE_VERSION,
        };
      }

      const files = await this.storage.readFiles(version.storageKey);

      return {
        success: true,
        data: {
          files,
          entryPath: version.entryPath,
        },
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'VERSION_NOT_FOUND') {
        return {
          success: false,
          error: TemplateErrors.INVALID_TEMPLATE_VERSION,
        };
      }

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
