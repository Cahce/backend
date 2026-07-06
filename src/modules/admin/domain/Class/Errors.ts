
export const ClassErrors = {
  HAS_LINKED_STUDENTS: {
    code: 'HAS_LINKED_STUDENTS',
    message: 'Không thể xóa lớp còn có sinh viên',
  },

  DUPLICATE_CODE: {
    code: 'DUPLICATE_CODE',
    message: 'Mã lớp đã tồn tại',
  },

  CLASS_NOT_FOUND: {
    code: 'CLASS_NOT_FOUND',
    message: 'Không tìm thấy lớp',
  },

  MAJOR_NOT_FOUND: {
    code: 'MAJOR_NOT_FOUND',
    message: 'Không tìm thấy ngành',
  },
} as const;
