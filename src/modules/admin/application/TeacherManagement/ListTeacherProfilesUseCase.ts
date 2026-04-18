// Use case for listing teacher profiles with filters and pagination
// No framework dependencies

import type { Result, PaginatedResult } from '../Types.js';
import { success, failure } from '../Types.js';
import type { TeacherProfileWithContext, TeacherFilters } from '../../domain/TeacherManagement/Types.js';
import type { TeacherProfileRepo } from '../../domain/TeacherManagement/Ports.js';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export class ListTeacherProfilesUseCase {
  constructor(private readonly teacherRepo: TeacherProfileRepo) {}

  async execute(filters: TeacherFilters): Promise<Result<PaginatedResult<TeacherProfileWithContext>>> {
    try {
      // Apply safe pagination defaults
      const page = Math.max(filters.page ?? DEFAULT_PAGE, 1);
      const pageSize = Math.min(
        Math.max(filters.pageSize ?? DEFAULT_PAGE_SIZE, 1),
        MAX_PAGE_SIZE
      );

      const result = await this.teacherRepo.findAll({
        ...filters,
        page,
        pageSize,
      });

      return success(result);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi lấy danh sách giảng viên');
    }
  }
}
