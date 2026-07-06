
export const FacultyErrors = {
  HAS_CHILD_DEPARTMENTS: {
    code: 'HAS_CHILD_DEPARTMENTS',
    message: 'Không thể xóa khoa còn có bộ môn',
  },

  HAS_CHILD_MAJORS: {
    code: 'HAS_CHILD_MAJORS',
    message: 'Không thể xóa khoa còn có ngành',
  },

  DUPLICATE_CODE: {
    code: 'DUPLICATE_CODE',
    message: 'Mã khoa đã tồn tại',
  },

  FACULTY_NOT_FOUND: {
    code: 'FACULTY_NOT_FOUND',
    message: 'Không tìm thấy khoa',
  },
} as const;
