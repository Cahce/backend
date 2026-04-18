// Use case for linking an account to a student profile
// No framework dependencies

import type { Result } from '../Types.js';
import type { StudentProfileRepo } from '../../domain/StudentManagement/Ports.js';
import type { AdminAccountRepo } from '../../domain/AccountManagement/Ports.js';
import { StudentPolicy } from '../../domain/StudentManagement/Policies.js';
import { AccountLinkingPolicy } from '../../domain/AccountManagement/Policies.js';
import { StudentErrors } from '../../domain/StudentManagement/Errors.js';
import { AccountErrors } from '../../domain/AccountManagement/Errors.js';

export class LinkAccountToStudentUseCase {
  constructor(
    private readonly studentRepo: StudentProfileRepo,
    private readonly accountRepo: AdminAccountRepo
  ) {}

  async execute(studentId: string, accountId: string): Promise<Result<void>> {
    // Check if student exists
    const student = await this.studentRepo.findById(studentId);
    if (!student) {
      return {
        success: false,
        error: StudentErrors.STUDENT_NOT_FOUND
      };
    }

    // Check if account exists
    const account = await this.accountRepo.findByIdWithProfile(accountId);
    if (!account) {
      return {
        success: false,
        error: AccountErrors.ACCOUNT_NOT_FOUND
      };
    }

    // Validate account can be linked to student
    const accountValidation = AccountLinkingPolicy.canLinkToStudent(account);
    if (!accountValidation.success) {
      return accountValidation;
    }

    // Validate student can be linked to account
    const studentValidation = StudentPolicy.canLinkAccount(student, account.role, accountId);
    if (!studentValidation.success) {
      return studentValidation;
    }

    // Link account to student
    await this.studentRepo.linkToAccount(studentId, accountId);

    return {
      success: true,
      data: undefined
    };
  }
}
