// Use case for deleting a teacher profile
// No framework dependencies

import type { Result } from '../Types.js';
import type { TeacherProfileRepo } from '../../domain/TeacherManagement/Ports.js';
import { TeacherPolicy } from '../../domain/TeacherManagement/Policies.js';
import { TeacherErrors } from '../../domain/TeacherManagement/Errors.js';

export class DeleteTeacherProfileUseCase {
  constructor(private readonly teacherRepo: TeacherProfileRepo) {}

  async execute(id: string): Promise<Result<void>> {
    // Check if teacher exists
    const teacher = await this.teacherRepo.findById(id);
    if (!teacher) {
      return {
        success: false,
        error: TeacherErrors.TEACHER_NOT_FOUND
      };
    }

    // Check if teacher has advisor assignments
    const hasAssignments = await this.teacherRepo.hasAdvisorAssignments(id);
    const canDelete = TeacherPolicy.canDeleteTeacher(hasAssignments);
    if (!canDelete.success) {
      return canDelete;
    }

    // Delete teacher profile
    await this.teacherRepo.delete(id);

    return {
      success: true,
      data: undefined
    };
  }
}
