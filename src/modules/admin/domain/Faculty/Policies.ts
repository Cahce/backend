/**
 * Faculty Domain Policies
 * 
 * Business rules and validation logic for Faculty operations.
 * No framework dependencies.
 */

import { Result, success, failure } from '../shared/Result.js';

/**
 * Faculty business policies
 */
export class FacultyPolicy {
  /**
   * Check if a Faculty can be deleted
   * 
   * Business rule: A Faculty cannot be deleted if it has:
   * - Child Departments
   * - Child Majors
   * 
   * @param hasDepartments - Whether the Faculty has any Departments
   * @param hasMajors - Whether the Faculty has any Majors
   * @returns Result indicating if deletion is allowed
   */
  static canDeleteFaculty(
    hasDepartments: boolean,
    hasMajors: boolean
  ): Result<void> {
    if (hasDepartments) {
      return failure(
        'HAS_CHILD_DEPARTMENTS',
        'Không thể xóa khoa còn có bộ môn'
      );
    }

    if (hasMajors) {
      return failure(
        'HAS_CHILD_MAJORS',
        'Không thể xóa khoa còn có ngành'
      );
    }

    return success(undefined);
  }
}
