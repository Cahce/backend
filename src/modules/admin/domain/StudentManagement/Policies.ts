
import type { Result } from '../../application/Types.js';
import type { StudentProfile } from './Types.js';
import { StudentErrors } from './Errors.js';

export class StudentPolicy {
  static validateStudentCode(code: string): Result<void> {
    const trimmed = code.trim();
    if (!trimmed || trimmed.length === 0) {
      return {
        success: false,
        error: StudentErrors.INVALID_STUDENT_CODE
      };
    }
    return { success: true, data: undefined };
  }

  static validateFullName(name: string): Result<void> {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length === 0) {
      return {
        success: false,
        error: StudentErrors.INVALID_FULL_NAME
      };
    }
    return { success: true, data: undefined };
  }

  static canLinkAccount(
    student: StudentProfile,
    accountRole: string,
    accountId: string
  ): Result<void> {
    if (accountRole !== 'student') {
      return {
        success: false,
        error: StudentErrors.ROLE_MISMATCH
      };
    }

    if (student.accountId && student.accountId !== accountId) {
      return {
        success: false,
        error: StudentErrors.STUDENT_ALREADY_LINKED
      };
    }

    return { success: true, data: undefined };
  }
}
