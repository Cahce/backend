/**
 * Update Template Use Case
 * 
 * Application layer orchestration for updating a template.
 */

import type { TemplateRepo } from '../domain/Ports.js';
import type { Template, UpdateTemplateData } from '../domain/Types.js';
import { TemplateErrors } from '../domain/Errors.js';

export type UpdateTemplateResult =
  | { success: true; data: Template }
  | { success: false; error: { code: string; message: string } };

/**
 * Use case for updating a template
 */
export class UpdateTemplateUseCase {
  constructor(private readonly templateRepo: TemplateRepo) {}

  async execute(id: string, patch: UpdateTemplateData): Promise<UpdateTemplateResult> {
    try {
      const template = await this.templateRepo.update(id, patch);

      return {
        success: true,
        data: template,
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'TEMPLATE_NOT_FOUND') {
        return {
          success: false,
          error: TemplateErrors.TEMPLATE_NOT_FOUND,
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
