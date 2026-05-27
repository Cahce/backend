// Domain policies for Account management
// Business rules and validation logic — pure domain, no framework deps.

import type { Result } from '../shared/Result.js';
import { success, failure } from '../shared/Result.js';
import { AccountErrors } from './Errors.js';
import type { AccountWithProfile, UserRole } from './Types.js';

// --- Email policy --------------------------------------------------------

/**
 * Email validation result.
 */
export type EmailValidationResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

/**
 * Email policy interface for validating email addresses by role.
 */
export interface EmailPolicy {
  validate(email: string, role: UserRole): EmailValidationResult;
}

const STUDENT_DOMAIN = '@e.tlu.edu.vn';
const STAFF_DOMAIN = '@tlu.edu.vn';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Default TLU email policy:
 * - student must use @e.tlu.edu.vn
 * - teacher and admin must use @tlu.edu.vn
 */
export class EnvEmailPolicy implements EmailPolicy {
  validate(email: string, role: UserRole): EmailValidationResult {
    if (!EMAIL_REGEX.test(email)) {
      return {
        ok: false,
        code: AccountErrors.INVALID_EMAIL_FORMAT.code,
        message: AccountErrors.INVALID_EMAIL_FORMAT.message,
      };
    }

    const normalizedEmail = email.toLowerCase().trim();
    const isStudentDomain = normalizedEmail.endsWith(STUDENT_DOMAIN);
    const isStaffDomain = normalizedEmail.endsWith(STAFF_DOMAIN);

    switch (role) {
      case 'student':
        if (!isStudentDomain) {
          return {
            ok: false,
            code: AccountErrors.INVALID_EMAIL_DOMAIN.code,
            message: `Email không đúng định dạng cho vai trò sinh viên. Yêu cầu: *${STUDENT_DOMAIN}`,
          };
        }
        break;
      case 'teacher':
      case 'admin':
        if (!isStaffDomain) {
          return {
            ok: false,
            code: AccountErrors.INVALID_EMAIL_DOMAIN.code,
            message: `Email không đúng định dạng cho vai trò ${EnvEmailPolicy.getRoleLabel(role)}. Yêu cầu: *${STAFF_DOMAIN}`,
          };
        }
        break;
      default:
        return {
          ok: false,
          code: AccountErrors.INVALID_ROLE.code,
          message: `Vai trò không hợp lệ: ${role}`,
        };
    }

    return { ok: true };
  }

  private static getRoleLabel(role: UserRole): string {
    switch (role) {
      case 'admin':
        return 'quản trị viên';
      case 'teacher':
        return 'giảng viên';
      case 'student':
        return 'sinh viên';
    }
  }

  static normalize(email: string): string {
    return email.toLowerCase().trim();
  }
}

// --- Account linking policy ---------------------------------------------

export class AccountLinkingPolicy {
  /**
   * Validates if an account can be linked to a teacher profile.
   * - Account must have 'teacher' role.
   * - Account must not already be linked to any profile.
   */
  static canLinkToTeacher(account: AccountWithProfile): Result<void> {
    if (account.role !== 'teacher') {
      return failure(
        AccountErrors.ROLE_MISMATCH.code,
        AccountErrors.ROLE_MISMATCH.message
      );
    }
    if (account.teacherProfile) {
      return failure(
        AccountErrors.ACCOUNT_ALREADY_LINKED_TO_TEACHER.code,
        AccountErrors.ACCOUNT_ALREADY_LINKED_TO_TEACHER.message
      );
    }
    if (account.studentProfile) {
      return failure(
        AccountErrors.ACCOUNT_ALREADY_LINKED_TO_STUDENT.code,
        AccountErrors.ACCOUNT_ALREADY_LINKED_TO_STUDENT.message
      );
    }
    return success(undefined);
  }

  /**
   * Validates if an account can be linked to a student profile.
   * - Account must have 'student' role.
   * - Account must not already be linked to any profile.
   */
  static canLinkToStudent(account: AccountWithProfile): Result<void> {
    if (account.role !== 'student') {
      return failure(
        AccountErrors.ROLE_MISMATCH.code,
        AccountErrors.ROLE_MISMATCH.message
      );
    }
    if (account.studentProfile) {
      return failure(
        AccountErrors.ACCOUNT_ALREADY_LINKED_TO_STUDENT.code,
        AccountErrors.ACCOUNT_ALREADY_LINKED_TO_STUDENT.message
      );
    }
    if (account.teacherProfile) {
      return failure(
        AccountErrors.ACCOUNT_ALREADY_LINKED_TO_TEACHER.code,
        AccountErrors.ACCOUNT_ALREADY_LINKED_TO_TEACHER.message
      );
    }
    return success(undefined);
  }

  /**
   * Validates if an account can be unlinked from its profile.
   */
  static canUnlinkFromProfile(account: AccountWithProfile): Result<void> {
    if (!account.teacherProfile && !account.studentProfile) {
      return failure(
        AccountErrors.ACCOUNT_NOT_LINKED.code,
        AccountErrors.ACCOUNT_NOT_LINKED.message
      );
    }
    return success(undefined);
  }
}
