/**
 * File Domain Errors
 * 
 * Domain-specific error codes and Vietnamese messages for File operations.
 * No framework dependencies.
 */

/**
 * File domain error definitions
 */
export const FileErrors = {
  /**
   * File not found
   */
  FILE_NOT_FOUND: {
    code: 'FILE_NOT_FOUND',
    message: 'Không tìm thấy tệp',
  },

  /**
   * File already exists at path
   */
  FILE_ALREADY_EXISTS: {
    code: 'FILE_ALREADY_EXISTS',
    message: 'Tệp đã tồn tại',
  },

  /**
   * Invalid file path
   */
  INVALID_FILE_PATH: {
    code: 'INVALID_FILE_PATH',
    message: 'Đường dẫn tệp không hợp lệ',
  },

  /**
   * Project not found
   */
  PROJECT_NOT_FOUND: {
    code: 'PROJECT_NOT_FOUND',
    message: 'Không tìm thấy dự án',
  },

  /**
   * Unauthorized access
   */
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: 'Không có quyền truy cập',
  },
} as const;
