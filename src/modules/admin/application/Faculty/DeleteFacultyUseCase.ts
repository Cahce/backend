
import type { FacultyRepo } from '../../domain/Faculty/Ports.js';
import { FacultyPolicy } from '../../domain/Faculty/Policies.js';
import { FacultyErrors } from '../../domain/Faculty/Errors.js';
import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';

export class DeleteFacultyUseCase {
  constructor(private readonly facultyRepo: FacultyRepo) {}

  async execute(id: string): Promise<Result<void>> {
    try {
      const faculty = await this.facultyRepo.findById(id);
      if (!faculty) {
        const error = FacultyErrors.FACULTY_NOT_FOUND;
        return failure(error.code, error.message);
      }

      const [hasDepartments, hasMajors] = await Promise.all([
        this.facultyRepo.hasChildDepartments(id),
        this.facultyRepo.hasChildMajors(id),
      ]);

      const policyResult = FacultyPolicy.canDeleteFaculty(hasDepartments, hasMajors);
      if (!policyResult.success) {
        return failure(policyResult.error.code, policyResult.error.message);
      }

      await this.facultyRepo.delete(id);
      return success(undefined);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi xóa khoa');
    }
  }
}
