// Use case for creating a student profile
// No framework dependencies

import type { Result } from '../Types.js';
import type { PasswordHasher } from '../../domain/shared/PasswordHasher.js';
import { success, failure } from '../Types.js';
import type { StudentProfile, CreateStudentData } from '../../domain/StudentManagement/Types.js';
import type { StudentProfileRepo } from '../../domain/StudentManagement/Ports.js';
import type { ClassRepo } from '../../domain/Class/Ports.js';
import type { AdminAccountRepo } from '../../domain/AccountManagement/Ports.js';
import { StudentPolicy } from '../../domain/StudentManagement/Policies.js';
import { StudentErrors } from '../../domain/StudentManagement/Errors.js';
import { EnvEmailPolicy } from '../../domain/AccountManagement/Policies.js';
import { AccountErrors } from '../../domain/AccountManagement/Errors.js';

export interface AccountInline {
  mode: 'none' | 'link' | 'create';
  accountId?: string;
  email?: string;
  password?: string;
}

export interface CreateStudentDataWithAccount extends CreateStudentData {
  account?: AccountInline;
}

export class CreateStudentProfileUseCase {
  private readonly emailPolicy = new EnvEmailPolicy();

  constructor(
    private readonly studentRepo: StudentProfileRepo,
    private readonly classRepo: ClassRepo,
    private readonly accountRepo: AdminAccountRepo,
    private readonly passwordHasher: PasswordHasher
  ) {}

  async execute(data: CreateStudentDataWithAccount): Promise<Result<StudentProfile>> {
    const codeValidation = StudentPolicy.validateStudentCode(data.studentCode);
    if (!codeValidation.success) {
      return codeValidation;
    }

    const nameValidation = StudentPolicy.validateFullName(data.fullName);
    if (!nameValidation.success) {
      return nameValidation;
    }

    const existing = await this.studentRepo.findByStudentCode(data.studentCode);
    if (existing) {
      return failure(
        StudentErrors.DUPLICATE_STUDENT_CODE.code,
        StudentErrors.DUPLICATE_STUDENT_CODE.message
      );
    }

    const academicClass = await this.classRepo.findById(data.classId);
    if (!academicClass) {
      return failure(StudentErrors.CLASS_NOT_FOUND.code, StudentErrors.CLASS_NOT_FOUND.message);
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
      const student = await this.studentRepo.create({
        ...data,
        accountId: finalAccountId,
      });
      return success(student);
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        return failure(
          StudentErrors.DUPLICATE_STUDENT_CODE.code,
          StudentErrors.DUPLICATE_STUDENT_CODE.message
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
        if (existingAccount.role !== 'student') {
          return failure('ACCOUNT_ROLE_MISMATCH', 'Tài khoản không có vai trò sinh viên');
        }
        if (existingAccount.studentProfile) {
          return failure(
            AccountErrors.ACCOUNT_ALREADY_LINKED_TO_STUDENT.code,
            AccountErrors.ACCOUNT_ALREADY_LINKED_TO_STUDENT.message
          );
        }
        return success(account.accountId);
      }

      case 'create': {
        if (!account.email || !account.password) {
          return failure('VALIDATION_ERROR', 'Email và mật khẩu là bắt buộc khi mode=create');
        }
        const emailValidation = this.emailPolicy.validate(account.email, 'student');
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
          role: 'student',
          isActive: true,
        });
        return success(newAccount.id);
      }

      default:
        return failure('VALIDATION_ERROR', 'Chế độ tài khoản không hợp lệ');
    }
  }
}
