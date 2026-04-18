// Use case for listing student profiles with filters and pagination
// No framework dependencies

import type { Result, PaginatedResult } from '../Types.js';
import { success, failure } from '../Types.js';
import type { StudentProfileWithContext, StudentFilters } from '../../domain/StudentManagement/Types.js';
import type { StudentProfileRepo } from '../../domain/StudentManagement/Ports.js';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export class ListStudentProfilesUseCase {
  constructor(private readonly studentRepo: StudentProfileRepo) {}

  async execute(filters: StudentFilters): Promise<Result<PaginatedResult<StudentProfileWithContext>>> {
    try {
      // Apply safe pagination defaults
      const page = Math.max(filters.page ?? DEFAULT_PAGE, 1);
      const pageSize = Math.min(
        Math.max(filters.pageSize ?? DEFAULT_PAGE_SIZE, 1),
        MAX_PAGE_SIZE
      );

      const result = await this.studentRepo.findAll({
        ...filters,
        page,
        pageSize,
      });

      return success(result);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi lấy danh sách sinh viên');
    }
  }
}
