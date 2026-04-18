// Repository port for Student management
// Defines the interface that infrastructure must implement

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
  /**
   * Create a new student profile
   */
  create(data: CreateStudentData): Promise<StudentProfile>;

  /**
   * Find student by ID
   */
  findById(id: string): Promise<StudentProfileWithContext | null>;

  /**
   * Find student by student code
   */
  findByStudentCode(code: string): Promise<StudentProfile | null>;

  /**
   * Find student by account ID
   */
  findByAccountId(accountId: string): Promise<StudentProfile | null>;

  /**
   * List students with filters and pagination
   */
  findAll(filters: StudentFilters): Promise<PaginatedResult<StudentProfileWithContext>>;

  /**
   * Update student profile
   */
  update(id: string, data: UpdateStudentData): Promise<StudentProfile>;

  /**
   * Delete student profile
   */
  delete(id: string): Promise<void>;

  /**
   * Link student profile to account
   */
  linkToAccount(studentId: string, accountId: string): Promise<void>;

  /**
   * Unlink student profile from account
   */
  unlinkFromAccount(studentId: string): Promise<void>;

  /**
   * Bulk import students from Excel
   * Creates or updates students based on mode
   */
  bulkUpsert(students: StudentImportRow[], mode: ImportMode): Promise<ImportResult>;
}
