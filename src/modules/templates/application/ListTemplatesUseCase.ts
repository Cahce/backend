/**
 * List Templates Use Case (Admin)
 *
 * Application layer orchestration for listing templates with filtering and
 * pagination. Each returned item now carries a `usageCount` — the number of
 * projects referencing the template (directly via `Project.templateId` or
 * indirectly via `Project.templateVersion.templateId`).
 *
 * Counts are batched in a single repo call to avoid N+1.
 */

import type { TemplateRepo } from '../domain/Ports.js';
import type { Template, TemplateFilter } from '../domain/Types.js';

export type TemplateWithUsage = Template & { usageCount: number };

export type ListTemplatesResult =
  | {
      success: true;
      data: {
        items: TemplateWithUsage[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      };
    }
  | { success: false; error: { code: string; message: string } };

/**
 * Use case for listing templates (admin)
 */
export class ListTemplatesUseCase {
  constructor(private readonly templateRepo: TemplateRepo) {}

  async execute(filter: TemplateFilter): Promise<ListTemplatesResult> {
    try {
      const { items, total } = await this.templateRepo.list(filter);

      const ids = items.map((t) => t.id);
      const usageCounts = await this.templateRepo.countUsageByTemplateIds(ids);

      const itemsWithUsage: TemplateWithUsage[] = items.map((t) => ({
        ...t,
        usageCount: usageCounts.get(t.id) ?? 0,
      }));

      const totalPages = Math.ceil(total / filter.pageSize);

      return {
        success: true,
        data: {
          items: itemsWithUsage,
          total,
          page: filter.page,
          pageSize: filter.pageSize,
          totalPages,
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
