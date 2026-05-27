// Use case for unlinking an account from a teacher profile
// No framework dependencies

import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';
import type { TeacherProfileRepo } from '../../domain/TeacherManagement/Ports.js';
import { TeacherErrors } from '../../domain/TeacherManagement/Errors.js';

export class UnlinkAccountFromTeacherUseCase {
  constructor(private readonly teacherRepo: TeacherProfileRepo) {}

  async execute(teacherId: string): Promise<Result<void>> {
    const teacher = await this.teacherRepo.findById(teacherId);
    if (!teacher) {
      return failure(TeacherErrors.TEACHER_NOT_FOUND.code, TeacherErrors.TEACHER_NOT_FOUND.message);
    }

    if (!teacher.accountId) {
      return failure('TEACHER_NOT_LINKED', 'Hồ sơ giáo viên chưa được liên kết với tài khoản');
    }

    await this.teacherRepo.unlinkFromAccount(teacherId);
    return success(undefined);
  }
}
