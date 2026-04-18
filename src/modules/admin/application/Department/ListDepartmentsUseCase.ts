/**
 * List Departments Use Case
 * 
 * Application layer orchestration for listing departments with pagination, search, and filters.
 * Pagination sanitization is handled at delivery layer; this use case applies safe defaults.
 */

import type { DepartmentRepo } from '../../domain/Department/Ports.js';
import type { DepartmentWithContext, DepartmentFilters } from '../../domain/Department/Types.js';
import type { Result, PaginatedResult } from '../Types.js';
import { success, failure } from '../Types.js';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export class ListDepartmentsUseCase {
  constructor(private readonly departmentRepo: DepartmentRepo) {}

  async execute(filters: DepartmentFilters): Promise<Result<PaginatedResult<DepartmentWithContext>>> {
    try {
      // Apply safe pagination defaults
      const page = Math.max(filters.page ?? DEFAULT_PAGE, 1);
      const pageSize = Math.min(
        Math.max(filters.pageSize ?? DEFAULT_PAGE_SIZE, 1),
        MAX_PAGE_SIZE
      );

      const result = await this.departmentRepo.findAll({
        ...filters,
        page,
        pageSize,
      });

      return success(result);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi lấy danh sách bộ môn');
    }
  }
}
