/**
 * List Faculties Use Case
 * 
 * Application layer orchestration for listing faculties with pagination and search.
 * Pagination sanitization is handled at delivery layer; this use case applies safe defaults.
 */

import type { FacultyRepo } from '../../domain/Faculty/Ports.js';
import type { Faculty, FacultyFilters } from '../../domain/Faculty/Types.js';
import type { Result, PaginatedResult } from '../Types.js';
import { success, failure } from '../Types.js';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export class ListFacultiesUseCase {
  constructor(private readonly facultyRepo: FacultyRepo) {}

  async execute(filters: FacultyFilters): Promise<Result<PaginatedResult<Faculty>>> {
    try {
      // Apply safe pagination defaults
      const page = Math.max(filters.page ?? DEFAULT_PAGE, 1);
      const pageSize = Math.min(
        Math.max(filters.pageSize ?? DEFAULT_PAGE_SIZE, 1),
        MAX_PAGE_SIZE
      );

      const result = await this.facultyRepo.findAll({
        ...filters,
        page,
        pageSize,
      });

      return success(result);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi lấy danh sách khoa');
    }
  }
}
