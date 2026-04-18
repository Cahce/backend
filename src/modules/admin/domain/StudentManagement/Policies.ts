// Domain policies for Student management
// Business rules and validation logic

import type { Result } from '../../application/Types.js';
import type { StudentProfile } from './Types.js';
import { StudentErrors } from './Errors.js';

export class StudentPolicy {
  /**
   * Validates student code format
   * Must be non-empty and trimmed
   */
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

  /**
   * Validates full name
   * Must be non-empty and trimmed
   */
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

  /**
   * Validates if an account can be linked to a student profile
   * - Account must have 'student' role
   * - Student must not already be linked to another account
   */
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
