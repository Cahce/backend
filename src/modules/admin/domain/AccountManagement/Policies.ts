// Domain policies for Account-Profile linking
// Business rules and validation logic

import type { Result } from '../../application/Types.js';
import type { AccountWithProfile } from './Types.js';
import { AccountErrors } from './Errors.js';

export class AccountLinkingPolicy {
  /**
   * Validates if an account can be linked to a teacher profile
   * - Account must have 'teacher' role
   * - Account must not already be linked to any profile
   */
  static canLinkToTeacher(account: AccountWithProfile): Result<void> {
    if (account.role !== 'teacher') {
      return {
        success: false,
        error: AccountErrors.ROLE_MISMATCH
      };
    }

    if (account.teacherProfile) {
      return {
        success: false,
        error: AccountErrors.ACCOUNT_ALREADY_LINKED_TO_TEACHER
      };
    }

    if (account.studentProfile) {
      return {
        success: false,
        error: AccountErrors.ACCOUNT_ALREADY_LINKED_TO_STUDENT
      };
    }

    return { success: true, data: undefined };
  }

  /**
   * Validates if an account can be linked to a student profile
   * - Account must have 'student' role
   * - Account must not already be linked to any profile
   */
  static canLinkToStudent(account: AccountWithProfile): Result<void> {
    if (account.role !== 'student') {
      return {
        success: false,
        error: AccountErrors.ROLE_MISMATCH
      };
    }

    if (account.studentProfile) {
      return {
        success: false,
        error: AccountErrors.ACCOUNT_ALREADY_LINKED_TO_STUDENT
      };
    }

    if (account.teacherProfile) {
      return {
        success: false,
        error: AccountErrors.ACCOUNT_ALREADY_LINKED_TO_TEACHER
      };
    }

    return { success: true, data: undefined };
  }

  /**
   * Validates if an account can be unlinked from its profile
   * - Account must be linked to a profile
   */
  static canUnlinkFromProfile(account: AccountWithProfile): Result<void> {
    if (!account.teacherProfile && !account.studentProfile) {
      return {
        success: false,
        error: AccountErrors.ACCOUNT_NOT_LINKED
      };
    }

    return { success: true, data: undefined };
  }
}
