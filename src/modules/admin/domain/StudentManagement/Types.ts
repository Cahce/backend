
export type Gender = 'male' | 'female' | 'other';

export type StudentProfile = {
  id: string;
  accountId: string | null;
  studentCode: string;
  fullName: string;
  classId: string;
  phone: string | null;
  gender: Gender | null;
  dateOfBirth: Date | null;
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type StudentProfileWithContext = StudentProfile & {
  class?: {
    id: string;
    name: string;
    code: string;
    majorId: string;
  };
  major?: {
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

export type CreateStudentData = {
  studentCode: string;
  fullName: string;
  classId: string;
  phone?: string;
  gender?: Gender | null;
  dateOfBirth?: Date | null;
  address?: string | null;
  accountId?: string;
};

export type UpdateStudentData = {
  studentCode?: string;
  fullName?: string;
  classId?: string;
  phone?: string | null;
  gender?: Gender | null;
  dateOfBirth?: Date | null;
  address?: string | null;
};

export type StudentFilters = {
  search?: string;
  classId?: string;
  majorId?: string;
  facultyId?: string;
  hasAccount?: boolean;
  page?: number;
  pageSize?: number;
};

export type StudentImportRow = {
  studentCode: string;
  fullName: string;
  classCode: string;
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
