// Domain types for Teacher profile management
// No framework dependencies - pure TypeScript

export type TeacherProfile = {
  id: string;
  accountId: string | null;
  teacherCode: string;
  fullName: string;
  departmentId: string;
  academicRank: string;
  academicDegree: string;
  phone: string | null;
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
  accountId?: string; // Optional account linking during creation
};

export type UpdateTeacherData = {
  teacherCode?: string;
  fullName?: string;
  departmentId?: string;
  academicRank?: string;
  academicDegree?: string;
  phone?: string | null;
};

export type TeacherFilters = {
  search?: string; // Search by name or teacherCode
  departmentId?: string;
  facultyId?: string; // Filter via Department.facultyId
  hasAccount?: boolean; // Filter by account link status
  page?: number;
  pageSize?: number;
};

// Import types for Excel import functionality
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
