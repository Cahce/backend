/**
 * Faculty Domain Errors
 * 
 * Domain-specific error codes and Vietnamese messages for Faculty operations.
 * No framework dependencies.
 */

/**
 * Faculty domain error definitions
 */
export const FacultyErrors = {
  /**
   * Faculty has child Departments and cannot be deleted
   */
  HAS_CHILD_DEPARTMENTS: {
    code: 'HAS_CHILD_DEPARTMENTS',
    message: 'Không thể xóa khoa còn có bộ môn',
  },

  /**
   * Faculty has child Majors and cannot be deleted
   */
  HAS_CHILD_MAJORS: {
    code: 'HAS_CHILD_MAJORS',
    message: 'Không thể xóa khoa còn có ngành',
  },

  /**
   * Faculty code already exists (duplicate)
   */
  DUPLICATE_CODE: {
    code: 'DUPLICATE_CODE',
    message: 'Mã khoa đã tồn tại',
  },

  /**
   * Faculty not found by ID
   */
  FACULTY_NOT_FOUND: {
    code: 'FACULTY_NOT_FOUND',
    message: 'Không tìm thấy khoa',
  },
} as const;
