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

  /**
   * Upload exceeded compressed or expanded size limit.
   * Mapped to HTTP 413.
   */
  ZIP_PAYLOAD_TOO_LARGE: {
    code: 'ZIP_PAYLOAD_TOO_LARGE',
    message: 'Tệp .zip vượt quá giới hạn cho phép',
  },

  /**
   * Zip contains a path traversal segment (e.g. `..`) or absolute path.
   * Mapped to HTTP 400.
   */
  ZIP_PATH_TRAVERSAL: {
    code: 'ZIP_PATH_TRAVERSAL',
    message: 'Tệp .zip chứa đường dẫn không hợp lệ',
  },

  /**
   * Zip is corrupt / not a valid archive.
   * Mapped to HTTP 400.
   */
  ZIP_MALFORMED: {
    code: 'ZIP_MALFORMED',
    message: 'Tệp .zip không hợp lệ hoặc bị hỏng',
  },

  /**
   * Upload missing the expected `file` field.
   */
  MISSING_FILE: {
    code: 'MISSING_FILE',
    message: 'Cần upload một tệp .zip',
  },

  /**
   * Uploaded archive is not a supported/recognized format (zip/7z/rar/tar).
   * Mapped to HTTP 400.
   */
  UNSUPPORTED_ARCHIVE: {
    code: 'UNSUPPORTED_ARCHIVE',
    message: 'Định dạng tệp nén không được hỗ trợ',
  },
} as const;
