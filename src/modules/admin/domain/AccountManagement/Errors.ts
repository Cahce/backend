// Domain errors for Account management
// Vietnamese error messages for user-facing errors

export const AccountErrors = {
  ACCOUNT_NOT_FOUND: {
    code: 'ACCOUNT_NOT_FOUND',
    message: 'Không tìm thấy tài khoản',
  },
  ACCOUNT_ALREADY_LINKED_TO_TEACHER: {
    code: 'ACCOUNT_ALREADY_LINKED_TO_TEACHER',
    message: 'Tài khoản đã được liên kết với hồ sơ giáo viên',
  },
  ACCOUNT_ALREADY_LINKED_TO_STUDENT: {
    code: 'ACCOUNT_ALREADY_LINKED_TO_STUDENT',
    message: 'Tài khoản đã được liên kết với hồ sơ sinh viên',
  },
  ACCOUNT_NOT_LINKED: {
    code: 'ACCOUNT_NOT_LINKED',
    message: 'Tài khoản chưa được liên kết với hồ sơ nào',
  },
  ROLE_MISMATCH: {
    code: 'ROLE_MISMATCH',
    message: 'Vai trò tài khoản không khớp với loại hồ sơ',
  },
  EMAIL_EXISTS: {
    code: 'EMAIL_EXISTS',
    message: 'Email đã tồn tại trong hệ thống',
  },
  INVALID_EMAIL_DOMAIN: {
    code: 'INVALID_EMAIL_DOMAIN',
    message: 'Email không đúng định dạng theo vai trò',
  },
  INVALID_EMAIL_FORMAT: {
    code: 'INVALID_EMAIL_FORMAT',
    message: 'Định dạng email không hợp lệ',
  },
  ACCOUNT_HAS_LINK: {
    code: 'ACCOUNT_HAS_LINK',
    message:
      'Không thể xóa tài khoản đang liên kết với hồ sơ giảng viên/sinh viên. Vui lòng hủy liên kết trước.',
  },
  INVALID_ROLE: {
    code: 'INVALID_ROLE',
    message: 'Vai trò không hợp lệ',
  },
} as const;
