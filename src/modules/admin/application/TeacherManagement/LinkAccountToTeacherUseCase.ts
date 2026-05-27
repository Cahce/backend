// Use case for linking an account to a teacher profile
// No framework dependencies

import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';
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
    const teacher = await this.teacherRepo.findById(teacherId);
    if (!teacher) {
      return failure(TeacherErrors.TEACHER_NOT_FOUND.code, TeacherErrors.TEACHER_NOT_FOUND.message);
    }

    const account = await this.accountRepo.findByIdWithProfile(accountId);
    if (!account) {
      return failure(AccountErrors.ACCOUNT_NOT_FOUND.code, AccountErrors.ACCOUNT_NOT_FOUND.message);
    }

    const accountValidation = AccountLinkingPolicy.canLinkToTeacher(account);
    if (!accountValidation.success) {
      return accountValidation;
    }

    const teacherValidation = TeacherPolicy.canLinkAccount(teacher, account.role, accountId);
    if (!teacherValidation.success) {
      return teacherValidation;
    }

    await this.teacherRepo.linkToAccount(teacherId, accountId);
    return success(undefined);
  }
}
