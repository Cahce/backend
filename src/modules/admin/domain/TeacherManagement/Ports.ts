// Repository port for Teacher management
// Defines the interface that infrastructure must implement

import type { PaginatedResult } from '../../application/Types.js';
import type {
  TeacherProfile,
  TeacherProfileWithContext,
  CreateTeacherData,
  UpdateTeacherData,
  TeacherFilters,
  TeacherImportRow,
  ImportMode,
  ImportResult
} from './Types.js';

export interface TeacherProfileRepo {
  /**
   * Create a new teacher profile
   */
  create(data: CreateTeacherData): Promise<TeacherProfile>;

  /**
   * Find teacher by ID
   */
  findById(id: string): Promise<TeacherProfileWithContext | null>;

  /**
   * Find teacher by teacher code
   */
  findByTeacherCode(code: string): Promise<TeacherProfile | null>;

  /**
   * Find teacher by account ID
   */
  findByAccountId(accountId: string): Promise<TeacherProfile | null>;

  /**
   * List teachers with filters and pagination
   */
  findAll(filters: TeacherFilters): Promise<PaginatedResult<TeacherProfileWithContext>>;

  /**
   * Update teacher profile
   */
  update(id: string, data: UpdateTeacherData): Promise<TeacherProfile>;

  /**
   * Delete teacher profile
   * Must check for advisor assignments before deletion
   */
  delete(id: string): Promise<void>;

  /**
   * Check if teacher has active advisor assignments
   */
  hasAdvisorAssignments(id: string): Promise<boolean>;

  /**
   * Link teacher profile to account
   */
  linkToAccount(teacherId: string, accountId: string): Promise<void>;

  /**
   * Unlink teacher profile from account
   */
  unlinkFromAccount(teacherId: string): Promise<void>;

  /**
   * Bulk import teachers from Excel
   * Creates or updates teachers based on mode
   */
  bulkUpsert(teachers: TeacherImportRow[], mode: ImportMode): Promise<ImportResult>;
}
