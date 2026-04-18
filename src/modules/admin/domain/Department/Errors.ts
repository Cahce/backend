/**
 * Department Domain Errors
 * 
 * Domain-specific error codes and Vietnamese messages for Department operations.
 * No framework dependencies.
 */

/**
 * Department domain error definitions
 */
export const DepartmentErrors = {
  /**
   * Department has linked Teachers and cannot be deleted
   */
  HAS_LINKED_TEACHERS: {
    code: 'HAS_LINKED_TEACHERS',
    message: 'Không thể xóa bộ môn còn có giáo viên',
  },

  /**
   * Department code already exists (duplicate)
   */
  DUPLICATE_CODE: {
    code: 'DUPLICATE_CODE',
    message: 'Mã bộ môn đã tồn tại',
  },

  /**
   * Department not found by ID
   */
  DEPARTMENT_NOT_FOUND: {
    code: 'DEPARTMENT_NOT_FOUND',
    message: 'Không tìm thấy bộ môn',
  },

  /**
   * Faculty not found when creating/updating Department
   */
  FACULTY_NOT_FOUND: {
    code: 'FACULTY_NOT_FOUND',
    message: 'Không tìm thấy khoa',
  },
} as const;
