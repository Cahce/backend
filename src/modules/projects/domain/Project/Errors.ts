
export const ProjectErrors = {
  PROJECT_NOT_FOUND: {
    code: 'PROJECT_NOT_FOUND',
    message: 'Không tìm thấy dự án',
  },

  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: 'Không có quyền truy cập',
  },

  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    message: 'Dữ liệu không hợp lệ',
  },

  ZIP_PAYLOAD_TOO_LARGE: {
    code: 'ZIP_PAYLOAD_TOO_LARGE',
    message: 'Tệp nén vượt quá giới hạn cho phép',
  },

  ZIP_PATH_TRAVERSAL: {
    code: 'ZIP_PATH_TRAVERSAL',
    message: 'Tệp nén chứa đường dẫn không hợp lệ',
  },

  ZIP_MALFORMED: {
    code: 'ZIP_MALFORMED',
    message: 'Tệp nén không hợp lệ hoặc bị hỏng',
  },

  MISSING_FILE: {
    code: 'MISSING_FILE',
    message: 'Cần upload một tệp nén',
  },

  UNSUPPORTED_ARCHIVE: {
    code: 'UNSUPPORTED_ARCHIVE',
    message: 'Định dạng tệp nén không được hỗ trợ',
  },
} as const;
