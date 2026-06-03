/**
 * Get Admin Project Detail Use Case
 *
 * Returns an admin-facing project detail (owner context + file summary). No
 * owner check — admin access is enforced at the route (`requireAdmin`).
 */

import type { AdminProjectRepo } from '../domain/Project/AdminProjectPorts.js';
import { ProjectErrors } from '../domain/Project/Errors.js';
import type { AdminProjectDetailDto } from './AdminProjectViews.js';
import { toDetailDto } from './AdminProjectViews.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';

export class GetAdminProjectDetailUseCase {
  constructor(private readonly repo: AdminProjectRepo) {}

  async execute(projectId: string): Promise<Result<AdminProjectDetailDto>> {
    try {
      const row = await this.repo.getDetailForAdmin(projectId);
      if (!row) {
        return failure(
          ProjectErrors.PROJECT_NOT_FOUND.code,
          ProjectErrors.PROJECT_NOT_FOUND.message,
        );
      }
      return success(toDetailDto(row));
    } catch {
      return failure('INTERNAL_ERROR', 'Lỗi khi lấy chi tiết dự án');
    }
  }
}
