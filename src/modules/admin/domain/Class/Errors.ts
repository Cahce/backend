/**
 * Class Domain Errors
 * 
 * Domain-specific error codes and Vietnamese messages for Class operations.
 * No framework dependencies.
 */

/**
 * Class domain error definitions
 */
export const ClassErrors = {
  /**
   * Class has linked Students and cannot be deleted
   */
  HAS_LINKED_STUDENTS: {
    code: 'HAS_LINKED_STUDENTS',
    message: 'Không thể xóa lớp còn có sinh viên',
  },

  /**
   * Class code already exists (duplicate)
   */
  DUPLICATE_CODE: {
    code: 'DUPLICATE_CODE',
    message: 'Mã lớp đã tồn tại',
  },

  /**
   * Class not found by ID
   */
  CLASS_NOT_FOUND: {
    code: 'CLASS_NOT_FOUND',
    message: 'Không tìm thấy lớp',
  },

  /**
   * Major not found when creating/updating Class
   */
  MAJOR_NOT_FOUND: {
    code: 'MAJOR_NOT_FOUND',
    message: 'Không tìm thấy ngành',
  },
} as const;
