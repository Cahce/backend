/**
 * List Public Templates Use Case
 * 
 * Application layer orchestration for listing active templates for users.
 * Only returns templates with at least one active version.
 */

import type { TemplateRepo } from '../domain/Ports.js';
import type { TemplateWithLatestVersion } from '../domain/Types.js';

export type ListPublicTemplatesResult =
  | { success: true; data: { templates: TemplateWithLatestVersion[] } }
  | { success: false; error: { code: string; message: string } };

/**
 * Use case for listing public templates
 */
export class ListPublicTemplatesUseCase {
  constructor(private readonly templateRepo: TemplateRepo) {}

  async execute(): Promise<ListPublicTemplatesResult> {
    try {
      const templates = await this.templateRepo.listPublic();

      return {
        success: true,
        data: {
          templates,
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
