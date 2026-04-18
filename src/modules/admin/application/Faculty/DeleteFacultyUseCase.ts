/**
 * Delete Faculty Use Case
 * 
 * Application layer orchestration for deleting a faculty.
 * Enforces business rules: cannot delete if has child departments or majors.
 */

import type { FacultyRepo } from '../../domain/Faculty/Ports.js';
import { FacultyPolicy } from '../../domain/Faculty/Policies.js';
import { FacultyErrors } from '../../domain/Faculty/Errors.js';
import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';

export class DeleteFacultyUseCase {
  constructor(private readonly facultyRepo: FacultyRepo) {}

  async execute(id: string): Promise<Result<void>> {
    try {
      // Check if faculty exists
      const faculty = await this.facultyRepo.findById(id);
      if (!faculty) {
        const error = FacultyErrors.FACULTY_NOT_FOUND;
        return failure(error.code, error.message);
      }

      // Check for child entities
      const hasDepartments = await this.facultyRepo.hasChildDepartments(id);
      const hasMajors = await this.facultyRepo.hasChildMajors(id);

      // Apply deletion policy
      const policyResult = FacultyPolicy.canDeleteFaculty(hasDepartments, hasMajors);
      if (!policyResult.success) {
        return failure(policyResult.error.code, policyResult.error.message);
      }

      // Delete faculty
      await this.facultyRepo.delete(id);
      return success(undefined);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi xóa khoa');
    }
  }
}
