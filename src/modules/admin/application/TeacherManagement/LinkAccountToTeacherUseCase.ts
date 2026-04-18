// Use case for linking an account to a teacher profile
// No framework dependencies

import type { Result } from '../Types.js';
import type { TeacherProfileRepo } from '../../domain/TeacherManagement/Ports.js';
import type { AdminAccountRepo } from '../../domain/AccountManagement/Ports.js';
import { TeacherPolicy } from '../../domain/TeacherManagement/Policies.js';
import { AccountLinkingPolicy } from '../../domain/AccountManagement/Policies.js';
import { TeacherErrors } from '../../domain/TeacherManagement/Errors.js';
import { AccountErrors } from '../../domain/AccountManagement/Errors.js';

export class LinkAccountToTeacherUseCase {
  constructor(
    private readonly teacherRepo: TeacherProfileRepo,
    private readonly accountRepo: AdminAccountRepo
  ) {}

  async execute(teacherId: string, accountId: string): Promise<Result<void>> {
    // Check if teacher exists
    const teacher = await this.teacherRepo.findById(teacherId);
    if (!teacher) {
      return {
        success: false,
        error: TeacherErrors.TEACHER_NOT_FOUND
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

    // Validate account can be linked to teacher
    const accountValidation = AccountLinkingPolicy.canLinkToTeacher(account);
    if (!accountValidation.success) {
      return accountValidation;
    }

    // Validate teacher can be linked to account
    const teacherValidation = TeacherPolicy.canLinkAccount(teacher, account.role, accountId);
    if (!teacherValidation.success) {
      return teacherValidation;
    }

    // Link account to teacher
    await this.teacherRepo.linkToAccount(teacherId, accountId);

    return {
      success: true,
      data: undefined
    };
  }
}
