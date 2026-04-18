// Domain types for Student profile management
// No framework dependencies - pure TypeScript

export type StudentProfile = {
  id: string;
  accountId: string | null;
  studentCode: string;
  fullName: string;
  classId: string;
  phone: string | null;
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
  accountId?: string; // Optional account linking during creation
};

export type UpdateStudentData = {
  studentCode?: string;
  fullName?: string;
  classId?: string;
  phone?: string | null;
};

export type StudentFilters = {
  search?: string; // Search by name or studentCode
  classId?: string;
  majorId?: string; // Filter via Class.majorId
  facultyId?: string; // Filter via Class.major.facultyId
  hasAccount?: boolean; // Filter by account link status
  page?: number;
  pageSize?: number;
};

// Import types for Excel import functionality
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
