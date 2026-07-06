
import { Result, success, failure } from '../shared/Result.js';

export class ClassPolicy {
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
