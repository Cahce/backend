// Use case for unlinking an account from a teacher profile
// No framework dependencies

import type { Result } from '../Types.js';
import type { TeacherProfileRepo } from '../../domain/TeacherManagement/Ports.js';
import { TeacherErrors } from '../../domain/TeacherManagement/Errors.js';

export class UnlinkAccountFromTeacherUseCase {
  constructor(private readonly teacherRepo: TeacherProfileRepo) {}

  async execute(teacherId: string): Promise<Result<void>> {
    // Check if teacher exists
    const teacher = await this.teacherRepo.findById(teacherId);
    if (!teacher) {
      return {
        success: false,
        error: TeacherErrors.TEACHER_NOT_FOUND
      };
    }

    // Check if teacher is linked to an account
    if (!teacher.accountId) {
      return {
        success: false,
        error: {
          code: 'TEACHER_NOT_LINKED',
          message: 'Hồ sơ giáo viên chưa được liên kết với tài khoản'
        }
      };
    }

    // Unlink account from teacher
    await this.teacherRepo.unlinkFromAccount(teacherId);

    return {
      success: true,
      data: undefined
    };
  }
}
