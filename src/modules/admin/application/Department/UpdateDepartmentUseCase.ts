/**
 * Update Department Use Case
 * 
 * Application layer orchestration for updating an existing department.
 */

import type { DepartmentRepo } from '../../domain/Department/Ports.js';
import type { FacultyRepo } from '../../domain/Faculty/Ports.js';
import type { Department, UpdateDepartmentData } from '../../domain/Department/Types.js';
import { DepartmentErrors } from '../../domain/Department/Errors.js';
import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';

export class UpdateDepartmentUseCase {
  constructor(
    private readonly departmentRepo: DepartmentRepo,
    private readonly facultyRepo: FacultyRepo
  ) {}

  async execute(
    id: string,
    data: UpdateDepartmentData
  ): Promise<Result<Department>> {
    try {
      // Check if department exists
      const existing = await this.departmentRepo.findById(id);
      if (!existing) {
        const error = DepartmentErrors.DEPARTMENT_NOT_FOUND;
        return failure(error.code, error.message);
      }

      // Validate parent faculty if facultyId is being changed
      if (data.facultyId && data.facultyId !== existing.facultyId) {
        const faculty = await this.facultyRepo.findById(data.facultyId);
        if (!faculty) {
          const error = DepartmentErrors.FACULTY_NOT_FOUND;
          return failure(error.code, error.message);
        }
      }

      // Check for duplicate code if code is being changed
      if (data.code && data.code !== existing.code) {
        const duplicate = await this.departmentRepo.findByCode(data.code);
        if (duplicate) {
          const error = DepartmentErrors.DUPLICATE_CODE;
          return failure(error.code, error.message);
        }
      }

      // Update department
      const department = await this.departmentRepo.update(id, data);
      return success(department);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi cập nhật bộ môn');
    }
  }
}
