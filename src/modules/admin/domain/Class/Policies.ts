/**
 * Class Domain Policies
 * 
 * Business rules and validation logic for Class operations.
 * No framework dependencies.
 */

import { Result, success, failure } from '../shared/Result.js';

/**
 * Class business policies
 */
export class ClassPolicy {
  /**
   * Check if a Class can be deleted
   * 
   * Business rule: A Class cannot be deleted if it has linked Students
   * 
   * @param hasStudents - Whether the Class has any linked Students
   * @returns Result indicating if deletion is allowed
   */
  static canDeleteClass(hasStudents: boolean): Result<void> {
    if (hasStudents) {
      return failure(
        'HAS_LINKED_STUDENTS',
        'Không thể xóa lớp còn có sinh viên'
      );
    }

    return success(undefined);
  }
}
