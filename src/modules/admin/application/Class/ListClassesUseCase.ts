/**
 * List Classes Use Case
 * 
 * Application layer orchestration for listing academic classes with pagination, search, and filters.
 * Pagination sanitization is handled at delivery layer; this use case applies safe defaults.
 */

import type { ClassRepo } from '../../domain/Class/Ports.js';
import type { ClassWithContext, ClassFilters } from '../../domain/Class/Types.js';
import type { Result, PaginatedResult } from '../Types.js';
import { success, failure } from '../Types.js';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export class ListClassesUseCase {
  constructor(private readonly classRepo: ClassRepo) {}

  async execute(filters: ClassFilters): Promise<Result<PaginatedResult<ClassWithContext>>> {
    try {
      // Apply safe pagination defaults
      const page = Math.max(filters.page ?? DEFAULT_PAGE, 1);
      const pageSize = Math.min(
        Math.max(filters.pageSize ?? DEFAULT_PAGE_SIZE, 1),
        MAX_PAGE_SIZE
      );

      const result = await this.classRepo.findAll({
        ...filters,
        page,
        pageSize,
      });

      return success(result);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi lấy danh sách lớp');
    }
  }
}
