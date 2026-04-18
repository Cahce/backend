/**
 * Get Department By Id Use Case
 * 
 * Application layer orchestration for retrieving a single department by ID.
 */

import type { DepartmentRepo } from '../../domain/Department/Ports.js';
import type { DepartmentWithContext } from '../../domain/Department/Types.js';
import { DepartmentErrors } from '../../domain/Department/Errors.js';
import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';

export class GetDepartmentByIdUseCase {
  constructor(private readonly departmentRepo: DepartmentRepo) {}

  async execute(id: string): Promise<Result<DepartmentWithContext>> {
    try {
      const department = await this.departmentRepo.findById(id);
      
      if (!department) {
        const error = DepartmentErrors.DEPARTMENT_NOT_FOUND;
        return failure(error.code, error.message);
      }

      return success(department);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi lấy thông tin bộ môn');
    }
  }
}
