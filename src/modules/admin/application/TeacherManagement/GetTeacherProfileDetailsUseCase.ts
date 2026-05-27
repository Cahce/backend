// Use case for getting teacher profile details by ID
// No framework dependencies

import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';
import type { TeacherProfileWithContext } from '../../domain/TeacherManagement/Types.js';
import type { TeacherProfileRepo } from '../../domain/TeacherManagement/Ports.js';
import { TeacherErrors } from '../../domain/TeacherManagement/Errors.js';

export class GetTeacherProfileDetailsUseCase {
  constructor(private readonly teacherRepo: TeacherProfileRepo) {}

  async execute(id: string): Promise<Result<TeacherProfileWithContext>> {
    const teacher = await this.teacherRepo.findById(id);
    if (!teacher) {
      return failure(TeacherErrors.TEACHER_NOT_FOUND.code, TeacherErrors.TEACHER_NOT_FOUND.message);
    }
    return success(teacher);
  }
}
