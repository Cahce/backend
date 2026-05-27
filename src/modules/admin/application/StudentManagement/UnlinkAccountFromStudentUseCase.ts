// Use case for unlinking an account from a student profile
// No framework dependencies

import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';
import type { StudentProfileRepo } from '../../domain/StudentManagement/Ports.js';
import { StudentErrors } from '../../domain/StudentManagement/Errors.js';

export class UnlinkAccountFromStudentUseCase {
  constructor(private readonly studentRepo: StudentProfileRepo) {}

  async execute(studentId: string): Promise<Result<void>> {
    const student = await this.studentRepo.findById(studentId);
    if (!student) {
      return failure(StudentErrors.STUDENT_NOT_FOUND.code, StudentErrors.STUDENT_NOT_FOUND.message);
    }

    if (!student.accountId) {
      return failure('STUDENT_NOT_LINKED', 'Hồ sơ sinh viên chưa được liên kết với tài khoản');
    }

    await this.studentRepo.unlinkFromAccount(studentId);
    return success(undefined);
  }
}
