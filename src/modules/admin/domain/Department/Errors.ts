
export const DepartmentErrors = {
  HAS_LINKED_TEACHERS: {
    code: 'HAS_LINKED_TEACHERS',
    message: 'Không thể xóa bộ môn còn có giáo viên',
  },

  DUPLICATE_CODE: {
    code: 'DUPLICATE_CODE',
    message: 'Mã bộ môn đã tồn tại',
  },

  DEPARTMENT_NOT_FOUND: {
    code: 'DEPARTMENT_NOT_FOUND',
    message: 'Không tìm thấy bộ môn',
  },

  FACULTY_NOT_FOUND: {
    code: 'FACULTY_NOT_FOUND',
    message: 'Không tìm thấy khoa',
  },
} as const;
