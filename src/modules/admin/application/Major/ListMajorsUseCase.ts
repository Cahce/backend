/**
 * List Majors Use Case
 * 
 * Application layer orchestration for listing majors with pagination, search, and filters.
 * Pagination sanitization is handled at delivery layer; this use case applies safe defaults.
 */

import type { MajorRepo } from '../../domain/Major/Ports.js';
import type { MajorWithContext, MajorFilters } from '../../domain/Major/Types.js';
import type { Result, PaginatedResult } from '../Types.js';
import { success, failure } from '../Types.js';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export class ListMajorsUseCase {
  constructor(private readonly majorRepo: MajorRepo) {}

  async execute(filters: MajorFilters): Promise<Result<PaginatedResult<MajorWithContext>>> {
    try {
      // Apply safe pagination defaults
      const page = Math.max(filters.page ?? DEFAULT_PAGE, 1);
      const pageSize = Math.min(
        Math.max(filters.pageSize ?? DEFAULT_PAGE_SIZE, 1),
        MAX_PAGE_SIZE
      );

      const result = await this.majorRepo.findAll({
        ...filters,
        page,
        pageSize,
      });

      return success(result);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi lấy danh sách ngành');
    }
  }
}
