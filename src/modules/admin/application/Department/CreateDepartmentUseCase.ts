/**
 * Create Department Use Case
 * 
 * Application layer orchestration for creating a new department.
 */

import type { DepartmentRepo } from '../../domain/Department/Ports.js';
import type { FacultyRepo } from '../../domain/Faculty/Ports.js';
import type { Department, CreateDepartmentData } from '../../domain/Department/Types.js';
import { DepartmentErrors } from '../../domain/Department/Errors.js';
import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';

export class CreateDepartmentUseCase {
  constructor(
    private readonly departmentRepo: DepartmentRepo,
    private readonly facultyRepo: FacultyRepo
  ) {}

  async execute(data: CreateDepartmentData): Promise<Result<Department>> {
    try {
      // Validate parent faculty exists
      const faculty = await this.facultyRepo.findById(data.facultyId);
      if (!faculty) {
        const error = DepartmentErrors.FACULTY_NOT_FOUND;
        return failure(error.code, error.message);
      }

      // Check for duplicate code
      const existing = await this.departmentRepo.findByCode(data.code);
      if (existing) {
        const error = DepartmentErrors.DUPLICATE_CODE;
        return failure(error.code, error.message);
      }

      // Create department
      const department = await this.departmentRepo.create(data);
      return success(department);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi tạo bộ môn');
    }
  }
}
