
import { Result, success, failure } from '../shared/Result.js';

export class MajorPolicy {
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
