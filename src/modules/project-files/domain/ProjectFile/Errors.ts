
export const FileErrors = {
  FILE_NOT_FOUND: {
    code: 'FILE_NOT_FOUND',
    message: 'Không tìm thấy tệp',
  },

  FILE_ALREADY_EXISTS: {
    code: 'FILE_ALREADY_EXISTS',
    message: 'Tệp đã tồn tại',
  },

  FILE_PATH_CONFLICT: {
    code: 'FILE_PATH_CONFLICT',
    message: 'Đường dẫn tệp đã tồn tại',
  },

  RENAME_TARGET_EXISTS: {
    code: 'RENAME_TARGET_EXISTS',
    message: 'Đường dẫn đích đã tồn tại',
  },

  INVALID_FILE_PATH: {
    code: 'INVALID_FILE_PATH',
    message: 'Đường dẫn tệp không hợp lệ',
  },

  PROJECT_NOT_FOUND: {
    code: 'PROJECT_NOT_FOUND',
    message: 'Không tìm thấy dự án',
  },

  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: 'Không có quyền truy cập',
  },
} as const;
