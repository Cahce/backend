
import type { Result } from '../../application/Types.js';
import type { TeacherProfile } from './Types.js';
import { TeacherErrors } from './Errors.js';

export class TeacherPolicy {
  static canDeleteTeacher(hasAdvisorAssignments: boolean): Result<void> {
    if (hasAdvisorAssignments) {
      return {
        success: false,
        error: TeacherErrors.TEACHER_HAS_ADVISOR_ASSIGNMENTS
      };
    }
    return { success: true, data: undefined };
  }

  static validateTeacherCode(code: string): Result<void> {
    const trimmed = code.trim();
    if (!trimmed || trimmed.length === 0) {
      return {
        success: false,
        error: TeacherErrors.INVALID_TEACHER_CODE
      };
    }
    return { success: true, data: undefined };
  }

  static validateFullName(name: string): Result<void> {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length === 0) {
      return {
        success: false,
        error: TeacherErrors.INVALID_FULL_NAME
      };
    }
    return { success: true, data: undefined };
  }

  static validateAcademicRank(rank: string): Result<void> {
    const trimmed = rank.trim();
    if (!trimmed || trimmed.length === 0) {
      return {
        success: false,
        error: TeacherErrors.INVALID_ACADEMIC_RANK
      };
    }
    return { success: true, data: undefined };
  }

  static validateAcademicDegree(degree: string): Result<void> {
    const trimmed = degree.trim();
    if (!trimmed || trimmed.length === 0) {
      return {
        success: false,
        error: TeacherErrors.INVALID_ACADEMIC_DEGREE
      };
    }
    return { success: true, data: undefined };
  }

  static canLinkAccount(
    teacher: TeacherProfile,
    accountRole: string,
    accountId: string
  ): Result<void> {
    if (accountRole !== 'teacher') {
      return {
        success: false,
        error: TeacherErrors.ROLE_MISMATCH
      };
    }

    if (teacher.accountId && teacher.accountId !== accountId) {
      return {
        success: false,
        error: TeacherErrors.TEACHER_ALREADY_LINKED
      };
    }

    return { success: true, data: undefined };
  }
}
