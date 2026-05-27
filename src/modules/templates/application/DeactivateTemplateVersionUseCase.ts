/**
 * Deactivate Template Version Use Case
 * 
 * Application layer orchestration for deactivating a template version.
 */

import type { TemplateRepo } from '../domain/Ports.js';
import type { TemplateVersion } from '../domain/Types.js';
import { TemplateErrors } from '../domain/Errors.js';

export type DeactivateTemplateVersionResult =
  | { success: true; data: TemplateVersion }
  | { success: false; error: { code: string; message: string } };

/**
 * Use case for deactivating a template version
 */
export class DeactivateTemplateVersionUseCase {
  constructor(private readonly templateRepo: TemplateRepo) {}

  async execute(versionId: string): Promise<DeactivateTemplateVersionResult> {
    try {
      const version = await this.templateRepo.setVersionActive(versionId, false);

      return {
        success: true,
        data: version,
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'VERSION_NOT_FOUND') {
        return {
          success: false,
          error: TemplateErrors.VERSION_NOT_FOUND,
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
