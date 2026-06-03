/**
 * Template Domain Errors
 * 
 * Domain-specific error codes and Vietnamese messages for Template operations.
 * No framework dependencies.
 */

/**
 * Template domain error definitions
 */
export const TemplateErrors = {
  /**
   * Template not found by ID
   */
  TEMPLATE_NOT_FOUND: {
    code: 'TEMPLATE_NOT_FOUND',
    message: 'Không tìm thấy mẫu',
  },

  /**
   * Template version not found by ID
   */
  VERSION_NOT_FOUND: {
    code: 'VERSION_NOT_FOUND',
    message: 'Không tìm thấy phiên bản mẫu',
  },

  /**
   * Template is in use by projects, cannot delete
   */
  TEMPLATE_IN_USE: {
    code: 'TEMPLATE_IN_USE',
    message: 'Không thể xóa mẫu đang được sử dụng bởi dự án',
  },

  /**
   * Version number already exists for this template
   */
  VERSION_EXISTS: {
    code: 'VERSION_EXISTS',
    message: 'Phiên bản này đã tồn tại',
  },

  /**
   * Invalid template version (not found or not active)
   */
  INVALID_TEMPLATE_VERSION: {
    code: 'INVALID_TEMPLATE_VERSION',
    message: 'Phiên bản mẫu không hợp lệ hoặc không còn hoạt động',
  },

  /**
   * Invalid archive format or content
   */
  INVALID_ARCHIVE: {
    code: 'INVALID_ARCHIVE',
    message: 'Tệp nén không hợp lệ hoặc thiếu main.typ',
  },

  /**
   * File too large
   */
  FILE_TOO_LARGE: {
    code: 'FILE_TOO_LARGE',
    message: 'Tệp quá lớn',
  },

  /**
   * Validation error
   */
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    message: 'Dữ liệu không hợp lệ',
  },

  /**
   * Unauthorized access
   */
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: 'Không có quyền truy cập',
  },

  /**
   * Template has no source project to publish from.
   */
  SOURCE_PROJECT_MISSING: {
    code: 'SOURCE_PROJECT_MISSING',
    message: 'Mẫu chưa có project nguồn để phát hành phiên bản',
  },
} as const;

/**
 * Custom error class for invalid template version
 * 
 * Thrown when a template version is not found or not active.
 * Used for cross-module error handling (projects module).
 */
export class InvalidTemplateVersionError extends Error {
  public readonly code = 'INVALID_TEMPLATE_VERSION';
  
  constructor(message: string = 'Phiên bản mẫu không hợp lệ hoặc không còn hoạt động') {
    super(message);
    this.name = 'InvalidTemplateVersionError';
    
    // Maintain proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InvalidTemplateVersionError);
    }
  }
}
