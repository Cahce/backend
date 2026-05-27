// Use case for deleting a teacher profile
// No framework dependencies

import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';
import type { TeacherProfileRepo } from '../../domain/TeacherManagement/Ports.js';
import { TeacherPolicy } from '../../domain/TeacherManagement/Policies.js';
import { TeacherErrors } from '../../domain/TeacherManagement/Errors.js';

export class DeleteTeacherProfileUseCase {
  constructor(private readonly teacherRepo: TeacherProfileRepo) {}

  async execute(id: string): Promise<Result<void>> {
    const teacher = await this.teacherRepo.findById(id);
    if (!teacher) {
      return failure(TeacherErrors.TEACHER_NOT_FOUND.code, TeacherErrors.TEACHER_NOT_FOUND.message);
    }

    const hasAssignments = await this.teacherRepo.hasAdvisorAssignments(id);
    const canDelete = TeacherPolicy.canDeleteTeacher(hasAssignments);
    if (!canDelete.success) {
      return canDelete;
    }

    await this.teacherRepo.delete(id);
    return success(undefined);
  }
}
