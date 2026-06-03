/**
 * List Admin Projects Use Case
 *
 * Lists projects across all owners (admin oversight) with filters, sorting and
 * pagination. Authorization is enforced at the route (`requireAdmin`); this
 * use case is role-agnostic.
 */

import type { AdminProjectRepo, AdminProjectFilters } from '../domain/Project/AdminProjectPorts.js';
import type { AdminProjectListDto } from './AdminProjectViews.js';
import { toListItemDto } from './AdminProjectViews.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';

export class ListAdminProjectsUseCase {
  constructor(private readonly repo: AdminProjectRepo) {}

  async execute(filters: AdminProjectFilters): Promise<Result<AdminProjectListDto>> {
    try {
      const { items, total } = await this.repo.listForAdmin(filters);
      return success({
        items: items.map(toListItemDto),
        total,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: Math.ceil(total / filters.pageSize),
      });
    } catch {
      return failure('INTERNAL_ERROR', 'Lỗi khi lấy danh sách dự án');
    }
  }
}
