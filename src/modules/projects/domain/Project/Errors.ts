/**
 * Project Domain Errors
 * 
 * Domain-specific error codes and Vietnamese messages for Project operations.
 * No framework dependencies.
 */

/**
 * Project domain error definitions
 */
export const ProjectErrors = {
  /**
   * Project not found by ID
   */
  PROJECT_NOT_FOUND: {
    code: 'PROJECT_NOT_FOUND',
    message: 'Không tìm thấy dự án',
  },

  /**
   * User is not authorized to perform the operation
   */
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: 'Không có quyền truy cập',
  },

  /**
   * Validation error (e.g., empty title)
   */
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    message: 'Dữ liệu không hợp lệ',
  },
} as const;
