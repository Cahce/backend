// Use case for unlinking an account from a student profile
// No framework dependencies

import type { Result } from '../Types.js';
import type { StudentProfileRepo } from '../../domain/StudentManagement/Ports.js';
import { StudentErrors } from '../../domain/StudentManagement/Errors.js';

export class UnlinkAccountFromStudentUseCase {
  constructor(private readonly studentRepo: StudentProfileRepo) {}

  async execute(studentId: string): Promise<Result<void>> {
    // Check if student exists
    const student = await this.studentRepo.findById(studentId);
    if (!student) {
      return {
        success: false,
        error: StudentErrors.STUDENT_NOT_FOUND
      };
    }

    // Check if student is linked to an account
    if (!student.accountId) {
      return {
        success: false,
        error: {
          code: 'STUDENT_NOT_LINKED',
          message: 'Hồ sơ sinh viên chưa được liên kết với tài khoản'
        }
      };
    }

    // Unlink account from student
    await this.studentRepo.unlinkFromAccount(studentId);

    return {
      success: true,
      data: undefined
    };
  }
}
