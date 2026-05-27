/**
 * Get Template By ID Use Case
 *
 * Application layer orchestration for retrieving a template by ID. Also
 * resolves `usageCount` so the admin detail response is consistent with the
 * list response (both expose the same DTO shape).
 */

import type { TemplateRepo } from '../domain/Ports.js';
import type { Template } from '../domain/Types.js';
import { TemplateErrors } from '../domain/Errors.js';

export type TemplateWithUsage = Template & { usageCount: number };

export type GetTemplateByIdResult =
  | { success: true; data: TemplateWithUsage }
  | { success: false; error: { code: string; message: string } };

/**
 * Use case for getting a template by ID
 */
export class GetTemplateByIdUseCase {
  constructor(private readonly templateRepo: TemplateRepo) {}

  async execute(id: string): Promise<GetTemplateByIdResult> {
    try {
      const template = await this.templateRepo.findById(id);

      if (!template) {
        return {
          success: false,
          error: TemplateErrors.TEMPLATE_NOT_FOUND,
        };
      }

      const usage = await this.templateRepo.countUsageByTemplateIds([id]);

      return {
        success: true,
        data: {
          ...template,
          usageCount: usage.get(id) ?? 0,
        },
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
