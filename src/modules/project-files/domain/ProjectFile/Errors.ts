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
   * File already exists at path (generic)
   */
  FILE_ALREADY_EXISTS: {
    code: 'FILE_ALREADY_EXISTS',
    message: 'Tệp đã tồn tại',
  },

  /**
   * POST /files — conflict: file already exists at the given path
   */
  FILE_PATH_CONFLICT: {
    code: 'FILE_PATH_CONFLICT',
    message: 'Đường dẫn tệp đã tồn tại',
  },

  /**
   * PATCH /files:rename — conflict: target path already occupied
   */
  RENAME_TARGET_EXISTS: {
    code: 'RENAME_TARGET_EXISTS',
    message: 'Đường dẫn đích đã tồn tại',
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
