
export type Gender = 'male' | 'female' | 'other';

export type TeacherProfile = {
  id: string;
  accountId: string | null;
  teacherCode: string;
  fullName: string;
  departmentId: string;
  academicRank: string;
  academicDegree: string;
  phone: string | null;
  gender: Gender | null;
  dateOfBirth: Date | null;
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TeacherProfileWithContext = TeacherProfile & {
  department?: {
    id: string;
    name: string;
    code: string;
    facultyId: string;
  };
  faculty?: {
    id: string;
    name: string;
    code: string;
  };
  account?: {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
  };
};

export type CreateTeacherData = {
  teacherCode: string;
  fullName: string;
  departmentId: string;
  academicRank: string;
  academicDegree: string;
  phone?: string;
  gender?: Gender | null;
  dateOfBirth?: Date | null;
  address?: string | null;
  accountId?: string;
};

export type UpdateTeacherData = {
  teacherCode?: string;
  fullName?: string;
  departmentId?: string;
  academicRank?: string;
  academicDegree?: string;
  phone?: string | null;
  gender?: Gender | null;
  dateOfBirth?: Date | null;
  address?: string | null;
};

export type TeacherFilters = {
  search?: string;
  departmentId?: string;
  facultyId?: string;
  hasAccount?: boolean;
  page?: number;
  pageSize?: number;
};

export type TeacherImportRow = {
  teacherCode: string;
  fullName: string;
  departmentCode: string;
  academicRank: string;
  academicDegree: string;
  phone?: string;
  email?: string;
  createAccount?: boolean;
};

export type ImportMode = 'skip-existing' | 'update-existing';

export type ImportResult = {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: RowError[];
};

export type RowError = {
  row: number;
  code: string;
  message: string;
  field?: string;
};
