
import type { TemplateRepo } from '../domain/Ports.js';
import type { TemplateVersion } from '../domain/Types.js';
import { TemplateErrors } from '../domain/Errors.js';

export type ListVersionsByTemplateResult =
  | { success: true; data: { versions: TemplateVersion[] } }
  | { success: false; error: { code: string; message: string } };

export class ListVersionsByTemplateUseCase {
  constructor(private readonly templateRepo: TemplateRepo) {}

  async execute(templateId: string): Promise<ListVersionsByTemplateResult> {
    try {
      const template = await this.templateRepo.findById(templateId);
      if (!template) {
        return {
          success: false,
          error: TemplateErrors.TEMPLATE_NOT_FOUND,
        };
      }

      const versions = await this.templateRepo.listVersionsByTemplate(templateId);

      return {
        success: true,
        data: {
          versions,
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
