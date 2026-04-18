/**
 * Delete Department Use Case
 * 
 * Application layer orchestration for deleting a department.
 * Enforces business rules: cannot delete if has linked teachers.
 */

import type { DepartmentRepo } from '../../domain/Department/Ports.js';
import { DepartmentPolicy } from '../../domain/Department/Policies.js';
import { DepartmentErrors } from '../../domain/Department/Errors.js';
import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';

export class DeleteDepartmentUseCase {
  constructor(private readonly departmentRepo: DepartmentRepo) {}

  async execute(id: string): Promise<Result<void>> {
    try {
      // Check if department exists
      const department = await this.departmentRepo.findById(id);
      if (!department) {
        const error = DepartmentErrors.DEPARTMENT_NOT_FOUND;
        return failure(error.code, error.message);
      }

      // Check for linked teachers
      const hasTeachers = await this.departmentRepo.hasLinkedTeachers(id);

      // Apply deletion policy
      const policyResult = DepartmentPolicy.canDeleteDepartment(hasTeachers);
      if (!policyResult.success) {
        return failure(policyResult.error.code, policyResult.error.message);
      }

      // Delete department
      await this.departmentRepo.delete(id);
      return success(undefined);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi xóa bộ môn');
    }
  }
}
