/**
 * Get Admin Project Stats Use Case
 *
 * Aggregate project counts for the admin oversight dashboard cards. Optional
 * ownerRole scopes `total` and `byCategory` to one role.
 */

import type { AdminProjectRepo, ProjectOwnerRole } from '../domain/Project/AdminProjectPorts.js';
import type { AdminProjectStatsDto } from './AdminProjectViews.js';
import { toStatsDto } from './AdminProjectViews.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';

export class GetAdminProjectStatsUseCase {
  constructor(private readonly repo: AdminProjectRepo) {}

  async execute(ownerRole?: ProjectOwnerRole): Promise<Result<AdminProjectStatsDto>> {
    try {
      const stats = await this.repo.stats(ownerRole);
      return success(toStatsDto(stats));
    } catch {
      return failure('INTERNAL_ERROR', 'Lỗi khi lấy thống kê dự án');
    }
  }
}
