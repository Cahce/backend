
export const MajorErrors = {
  HAS_CHILD_CLASSES: {
    code: 'HAS_CHILD_CLASSES',
    message: 'Không thể xóa ngành còn có lớp',
  },

  DUPLICATE_CODE: {
    code: 'DUPLICATE_CODE',
    message: 'Mã ngành đã tồn tại',
  },

  MAJOR_NOT_FOUND: {
    code: 'MAJOR_NOT_FOUND',
    message: 'Không tìm thấy ngành',
  },

  FACULTY_NOT_FOUND: {
    code: 'FACULTY_NOT_FOUND',
    message: 'Không tìm thấy khoa',
  },
} as const;
