/**
 * Create Template Use Case
 * 
 * Application layer orchestration for creating a new template.
 * No persistence logic - delegates to repository.
 */

import type { TemplateRepo } from '../domain/Ports.js';
import type { Template, CreateTemplateData } from '../domain/Types.js';
import { TemplateErrors } from '../domain/Errors.js';

export type CreateTemplateResult =
  | { success: true; data: Template }
  | { success: false; error: { code: string; message: string } };

/**
 * Use case for creating a new template
 */
export class CreateTemplateUseCase {
  constructor(private readonly templateRepo: TemplateRepo) {}

  async execute(input: CreateTemplateData): Promise<CreateTemplateResult> {
    try {
      // Validate input
      if (!input.name || input.name.trim().length === 0) {
        return {
          success: false,
          error: TemplateErrors.VALIDATION_ERROR,
        };
      }

      const template = await this.templateRepo.create(input);

      return {
        success: true,
        data: template,
      };
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
