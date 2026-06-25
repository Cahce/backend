// Use case for creating a teacher profile
// No framework dependencies

import type { Result } from '../Types.js';
import type { PasswordHasher } from '../../domain/shared/PasswordHasher.js';
import { success, failure } from '../Types.js';
import type { TeacherProfile, CreateTeacherData } from '../../domain/TeacherManagement/Types.js';
import type { TeacherProfileRepo } from '../../domain/TeacherManagement/Ports.js';
import type { DepartmentRepo } from '../../domain/Department/Ports.js';
import type { AdminAccountRepo } from '../../domain/AccountManagement/Ports.js';
import { TeacherPolicy } from '../../domain/TeacherManagement/Policies.js';
import { TeacherErrors } from '../../domain/TeacherManagement/Errors.js';
import { EnvEmailPolicy } from '../../domain/AccountManagement/Policies.js';
import { AccountErrors } from '../../domain/AccountManagement/Errors.js';

export interface AccountInline {
  mode: 'none' | 'link' | 'create';
  accountId?: string;
  email?: string;
  password?: string;
}

export interface CreateTeacherDataWithAccount extends CreateTeacherData {
  account?: AccountInline;
}

export class CreateTeacherProfileUseCase {
  private readonly emailPolicy = new EnvEmailPolicy();

  constructor(
    private readonly teacherRepo: TeacherProfileRepo,
    private readonly departmentRepo: DepartmentRepo,
    private readonly accountRepo: AdminAccountRepo,
    private readonly passwordHasher: PasswordHasher
  ) {}

  async execute(data: CreateTeacherDataWithAccount): Promise<Result<TeacherProfile>> {
    const codeValidation = TeacherPolicy.validateTeacherCode(data.teacherCode);
    if (!codeValidation.success) {
      return codeValidation;
    }

    const nameValidation = TeacherPolicy.validateFullName(data.fullName);
    if (!nameValidation.success) {
      return nameValidation;
    }

    const rankValidation = TeacherPolicy.validateAcademicRank(data.academicRank);
    if (!rankValidation.success) {
      return rankValidation;
    }

    const degreeValidation = TeacherPolicy.validateAcademicDegree(data.academicDegree);
    if (!degreeValidation.success) {
      return degreeValidation;
    }

    const existing = await this.teacherRepo.findByTeacherCode(data.teacherCode);
    if (existing) {
      return failure(
        TeacherErrors.DUPLICATE_TEACHER_CODE.code,
        TeacherErrors.DUPLICATE_TEACHER_CODE.message
      );
    }

    const department = await this.departmentRepo.findById(data.departmentId);
    if (!department) {
      return failure(
        TeacherErrors.DEPARTMENT_NOT_FOUND.code,
        TeacherErrors.DEPARTMENT_NOT_FOUND.message
      );
    }

    let finalAccountId: string | undefined = data.accountId;
    if (data.account) {
      const accountResult = await this.handleAccountInline(data.account);
      if (!accountResult.success) {
        return accountResult;
      }
      finalAccountId = accountResult.data;
    }

    try {
      const teacher = await this.teacherRepo.create({
        ...data,
        accountId: finalAccountId,
      });
      return success(teacher);
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        return failure(
          TeacherErrors.DUPLICATE_TEACHER_CODE.code,
          TeacherErrors.DUPLICATE_TEACHER_CODE.message
        );
      }
      throw error;
    }
  }

  private async handleAccountInline(account: AccountInline): Promise<Result<string | undefined>> {
    switch (account.mode) {
      case 'none':
        return success(undefined);

      case 'link': {
        if (!account.accountId) {
          return failure('VALIDATION_ERROR', 'ID tài khoản là bắt buộc khi mode=link');
        }
        const existingAccount = await this.accountRepo.findByIdWithProfile(account.accountId);
        if (!existingAccount) {
          return failure(
            AccountErrors.ACCOUNT_NOT_FOUND.code,
            AccountErrors.ACCOUNT_NOT_FOUND.message
          );
        }
        if (existingAccount.role !== 'teacher') {
          return failure('ACCOUNT_ROLE_MISMATCH', 'Tài khoản không có vai trò giảng viên');
        }
        if (existingAccount.teacherProfile) {
          return failure(
            AccountErrors.ACCOUNT_ALREADY_LINKED_TO_TEACHER.code,
            AccountErrors.ACCOUNT_ALREADY_LINKED_TO_TEACHER.message
          );
        }
        return success(account.accountId);
      }

      case 'create': {
        if (!account.email || !account.password) {
          return failure('VALIDATION_ERROR', 'Email và mật khẩu là bắt buộc khi mode=create');
        }
        const emailValidation = this.emailPolicy.validate(account.email, 'teacher');
        if (!emailValidation.ok) {
          return failure(emailValidation.code, emailValidation.message);
        }
        const normalizedEmail = EnvEmailPolicy.normalize(account.email);
        const existingEmailAccount = await this.accountRepo.findByEmailWithProfile(normalizedEmail);
        if (existingEmailAccount) {
          return failure(AccountErrors.EMAIL_EXISTS.code, AccountErrors.EMAIL_EXISTS.message);
        }
        const hashedPassword = await this.passwordHasher.hash(account.password);
        const newAccount = await this.accountRepo.create({
          email: normalizedEmail,
          passwordHash: hashedPassword,
          role: 'teacher',
          isActive: true,
        });
        return success(newAccount.id);
      }

      default:
        return failure('VALIDATION_ERROR', 'Chế độ tài khoản không hợp lệ');
    }
  }
}
