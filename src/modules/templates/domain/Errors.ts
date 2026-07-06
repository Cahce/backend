
export const TemplateErrors = {
  TEMPLATE_NOT_FOUND: {
    code: 'TEMPLATE_NOT_FOUND',
    message: 'Không tìm thấy mẫu',
  },

  VERSION_NOT_FOUND: {
    code: 'VERSION_NOT_FOUND',
    message: 'Không tìm thấy phiên bản mẫu',
  },

  TEMPLATE_IN_USE: {
    code: 'TEMPLATE_IN_USE',
    message: 'Không thể xóa mẫu đang được sử dụng bởi dự án',
  },

  VERSION_EXISTS: {
    code: 'VERSION_EXISTS',
    message: 'Phiên bản này đã tồn tại, vui lòng nhập số khác',
  },

  INVALID_TEMPLATE_VERSION: {
    code: 'INVALID_TEMPLATE_VERSION',
    message: 'Phiên bản mẫu không hợp lệ hoặc không còn hoạt động',
  },

  INVALID_ARCHIVE: {
    code: 'INVALID_ARCHIVE',
    message: 'Tệp nén không hợp lệ hoặc thiếu main.typ',
  },

  FILE_TOO_LARGE: {
    code: 'FILE_TOO_LARGE',
    message: 'Tệp quá lớn',
  },

  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    message: 'Dữ liệu không hợp lệ',
  },

  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: 'Không có quyền truy cập',
  },

  SOURCE_PROJECT_MISSING: {
    code: 'SOURCE_PROJECT_MISSING',
    message: 'Mẫu chưa có project nguồn để phát hành phiên bản',
  },
} as const;

export class InvalidTemplateVersionError extends Error {
  public readonly code = 'INVALID_TEMPLATE_VERSION';
  
  constructor(message: string = 'Phiên bản mẫu không hợp lệ hoặc không còn hoạt động') {
    super(message);
    this.name = 'InvalidTemplateVersionError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InvalidTemplateVersionError);
    }
  }
}
