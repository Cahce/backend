
import { Result, success, failure } from '../shared/Result.js';

export class DepartmentPolicy {
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
