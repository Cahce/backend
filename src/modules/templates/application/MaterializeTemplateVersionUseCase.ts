/**
 * Materialize Template Version Use Case
 * 
 * Application layer orchestration for materializing template version files.
 * This is the cross-module interface used by projects module.
 */

import type { TemplateRepo, TemplateStorageGateway } from '../domain/Ports.js';
import type { MaterializedFile } from '../domain/Types.js';
import { TemplateErrors } from '../domain/Errors.js';

export type MaterializeTemplateVersionResult =
  | { success: true; data: { files: MaterializedFile[]; entryPath: string } }
  | { success: false; error: { code: string; message: string } };

/**
 * Use case for materializing template version files
 * 
 * This is exported for cross-module use by projects module.
 */
export class MaterializeTemplateVersionUseCase {
  constructor(
    private readonly templateRepo: TemplateRepo,
    private readonly storage: TemplateStorageGateway,
  ) {}

  /**
   * Execute the use case
   * 
   * @param versionId - Template version ID
   * @returns List of materialized files
   */
  async execute(versionId: string): Promise<MaterializeTemplateVersionResult> {
    try {
      // Find version
      const version = await this.templateRepo.findVersionById(versionId);
      if (!version) {
        return {
          success: false,
          error: TemplateErrors.INVALID_TEMPLATE_VERSION,
        };
      }

      // Check if version is active
      if (!version.isActive) {
        return {
          success: false,
          error: TemplateErrors.INVALID_TEMPLATE_VERSION,
        };
      }

      // Read files from storage
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
