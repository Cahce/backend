/**
 * Major Domain Errors
 * 
 * Domain-specific error codes and Vietnamese messages for Major operations.
 * No framework dependencies.
 */

/**
 * Major domain error definitions
 */
export const MajorErrors = {
  /**
   * Major has child AcademicClasses and cannot be deleted
   */
  HAS_CHILD_CLASSES: {
    code: 'HAS_CHILD_CLASSES',
    message: 'Không thể xóa ngành còn có lớp',
  },

  /**
   * Major code already exists (duplicate)
   */
  DUPLICATE_CODE: {
    code: 'DUPLICATE_CODE',
    message: 'Mã ngành đã tồn tại',
  },

  /**
   * Major not found by ID
   */
  MAJOR_NOT_FOUND: {
    code: 'MAJOR_NOT_FOUND',
    message: 'Không tìm thấy ngành',
  },

  /**
   * Faculty not found when creating/updating Major
   */
  FACULTY_NOT_FOUND: {
    code: 'FACULTY_NOT_FOUND',
    message: 'Không tìm thấy khoa',
  },
} as const;
