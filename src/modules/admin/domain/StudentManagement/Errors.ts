// Domain errors for Student management
// Vietnamese error messages for user-facing errors

export const StudentErrors = {
  STUDENT_NOT_FOUND: {
    code: 'STUDENT_NOT_FOUND',
    message: 'Không tìm thấy sinh viên'
  },
  DUPLICATE_STUDENT_CODE: {
    code: 'DUPLICATE_STUDENT_CODE',
    message: 'Mã sinh viên đã tồn tại'
  },
  CLASS_NOT_FOUND: {
    code: 'CLASS_NOT_FOUND',
    message: 'Không tìm thấy lớp học'
  },
  INVALID_STUDENT_CODE: {
    code: 'INVALID_STUDENT_CODE',
    message: 'Mã sinh viên không hợp lệ'
  },
  INVALID_FULL_NAME: {
    code: 'INVALID_FULL_NAME',
    message: 'Họ tên không hợp lệ'
  },
  ACCOUNT_ALREADY_LINKED: {
    code: 'ACCOUNT_ALREADY_LINKED',
    message: 'Tài khoản đã được liên kết với hồ sơ khác'
  },
  STUDENT_ALREADY_LINKED: {
    code: 'STUDENT_ALREADY_LINKED',
    message: 'Hồ sơ sinh viên đã được liên kết với tài khoản khác'
  },
  ACCOUNT_NOT_FOUND: {
    code: 'ACCOUNT_NOT_FOUND',
    message: 'Không tìm thấy tài khoản'
  },
  ROLE_MISMATCH: {
    code: 'ROLE_MISMATCH',
    message: 'Vai trò tài khoản không khớp với loại hồ sơ'
  }
} as const;
