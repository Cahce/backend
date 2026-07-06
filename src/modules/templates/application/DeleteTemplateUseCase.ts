
import type { TemplateRepo } from '../domain/Ports.js';
import { TemplateErrors } from '../domain/Errors.js';

export type DeleteTemplateResult =
  | { success: true }
  | { success: false; error: { code: string; message: string } };

export class DeleteTemplateUseCase {
  constructor(private readonly templateRepo: TemplateRepo) {}

  async execute(id: string): Promise<DeleteTemplateResult> {
    try {
      const template = await this.templateRepo.findById(id);
      if (!template) {
        return {
          success: false,
          error: TemplateErrors.TEMPLATE_NOT_FOUND,
        };
      }

      const projectCount = await this.templateRepo.countProjectsUsing(id);
      if (projectCount > 0) {
        return {
          success: false,
          error: TemplateErrors.TEMPLATE_IN_USE,
        };
      }

      await this.templateRepo.delete(id);

      return {
        success: true,
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
