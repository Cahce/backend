// Domain errors for Account management
// Vietnamese error messages for user-facing errors

export const AccountErrors = {
  ACCOUNT_NOT_FOUND: {
    code: 'ACCOUNT_NOT_FOUND',
    message: 'Không tìm thấy tài khoản'
  },
  ACCOUNT_ALREADY_LINKED_TO_TEACHER: {
    code: 'ACCOUNT_ALREADY_LINKED_TO_TEACHER',
    message: 'Tài khoản đã được liên kết với hồ sơ giáo viên'
  },
  ACCOUNT_ALREADY_LINKED_TO_STUDENT: {
    code: 'ACCOUNT_ALREADY_LINKED_TO_STUDENT',
    message: 'Tài khoản đã được liên kết với hồ sơ sinh viên'
  },
  ACCOUNT_NOT_LINKED: {
    code: 'ACCOUNT_NOT_LINKED',
    message: 'Tài khoản chưa được liên kết với hồ sơ nào'
  },
  ROLE_MISMATCH: {
    code: 'ROLE_MISMATCH',
    message: 'Vai trò tài khoản không khớp với loại hồ sơ'
  }
} as const;
