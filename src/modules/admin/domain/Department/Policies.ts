/**
 * Department Domain Policies
 * 
 * Business rules and validation logic for Department operations.
 * No framework dependencies.
 */

import { Result, success, failure } from '../shared/Result.js';

/**
 * Department business policies
 */
export class DepartmentPolicy {
  /**
   * Check if a Department can be deleted
   * 
   * Business rule: A Department cannot be deleted if it has linked Teachers
   * 
   * @param hasTeachers - Whether the Department has any linked Teachers
   * @returns Result indicating if deletion is allowed
   */
  static canDeleteDepartment(hasTeachers: boolean): Result<void> {
    if (hasTeachers) {
      return failure(
        'HAS_LINKED_TEACHERS',
        'Không thể xóa bộ môn còn có giáo viên'
      );
    }

    return success(undefined);
  }
}
