
import type { PaginatedResult } from '../../application/Types.js';
import type {
  StudentProfile,
  StudentProfileWithContext,
  CreateStudentData,
  UpdateStudentData,
  StudentFilters,
  StudentImportRow,
  ImportMode,
  ImportResult
} from './Types.js';

export interface StudentProfileRepo {
  create(data: CreateStudentData): Promise<StudentProfile>;

  findById(id: string): Promise<StudentProfileWithContext | null>;

  findByStudentCode(code: string): Promise<StudentProfile | null>;

  findByAccountId(accountId: string): Promise<StudentProfile | null>;

  findAll(filters: StudentFilters): Promise<PaginatedResult<StudentProfileWithContext>>;

  update(id: string, data: UpdateStudentData): Promise<StudentProfile>;

  delete(id: string): Promise<void>;

  linkToAccount(studentId: string, accountId: string): Promise<void>;

  unlinkFromAccount(studentId: string): Promise<void>;

  bulkUpsert(students: StudentImportRow[], mode: ImportMode): Promise<ImportResult>;
}
