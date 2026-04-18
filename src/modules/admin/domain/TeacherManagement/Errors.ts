// Domain errors for Teacher management
// Vietnamese error messages for user-facing errors

export const TeacherErrors = {
  TEACHER_NOT_FOUND: {
    code: 'TEACHER_NOT_FOUND',
    message: 'Không tìm thấy giáo viên'
  },
  DUPLICATE_TEACHER_CODE: {
    code: 'DUPLICATE_TEACHER_CODE',
    message: 'Mã giáo viên đã tồn tại'
  },
  DEPARTMENT_NOT_FOUND: {
    code: 'DEPARTMENT_NOT_FOUND',
    message: 'Không tìm thấy bộ môn'
  },
  INVALID_TEACHER_CODE: {
    code: 'INVALID_TEACHER_CODE',
    message: 'Mã giáo viên không hợp lệ'
  },
  INVALID_FULL_NAME: {
    code: 'INVALID_FULL_NAME',
    message: 'Họ tên không hợp lệ'
  },
  INVALID_ACADEMIC_RANK: {
    code: 'INVALID_ACADEMIC_RANK',
    message: 'Học hàm không hợp lệ'
  },
  INVALID_ACADEMIC_DEGREE: {
    code: 'INVALID_ACADEMIC_DEGREE',
    message: 'Học vị không hợp lệ'
  },
  TEACHER_HAS_ADVISOR_ASSIGNMENTS: {
    code: 'TEACHER_HAS_ADVISOR_ASSIGNMENTS',
    message: 'Không thể xóa giáo viên đang hướng dẫn đồ án'
  },
  ACCOUNT_ALREADY_LINKED: {
    code: 'ACCOUNT_ALREADY_LINKED',
    message: 'Tài khoản đã được liên kết với hồ sơ khác'
  },
  TEACHER_ALREADY_LINKED: {
    code: 'TEACHER_ALREADY_LINKED',
    message: 'Hồ sơ giáo viên đã được liên kết với tài khoản khác'
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
