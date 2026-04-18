/**
 * Major Domain Policies
 * 
 * Business rules and validation logic for Major operations.
 * No framework dependencies.
 */

import { Result, success, failure } from '../shared/Result.js';

/**
 * Major business policies
 */
export class MajorPolicy {
  /**
   * Check if a Major can be deleted
   * 
   * Business rule: A Major cannot be deleted if it has child AcademicClasses
   * 
   * @param hasClasses - Whether the Major has any child AcademicClasses
   * @returns Result indicating if deletion is allowed
   */
  static canDeleteMajor(hasClasses: boolean): Result<void> {
    if (hasClasses) {
      return failure(
        'HAS_CHILD_CLASSES',
        'Không thể xóa ngành còn có lớp'
      );
    }

    return success(undefined);
  }
}
