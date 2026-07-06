
import { Result, success, failure } from '../shared/Result.js';

export class FacultyPolicy {
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
