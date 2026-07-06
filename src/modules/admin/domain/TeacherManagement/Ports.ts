
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
  create(data: CreateTeacherData): Promise<TeacherProfile>;

  listAllTeacherCodes(): Promise<string[]>;

  findById(id: string): Promise<TeacherProfileWithContext | null>;

  findByTeacherCode(code: string): Promise<TeacherProfile | null>;

  findByAccountId(accountId: string): Promise<TeacherProfile | null>;

  findAll(filters: TeacherFilters): Promise<PaginatedResult<TeacherProfileWithContext>>;

  update(id: string, data: UpdateTeacherData): Promise<TeacherProfile>;

  delete(id: string): Promise<void>;

  hasAdvisorAssignments(id: string): Promise<boolean>;

  linkToAccount(teacherId: string, accountId: string): Promise<void>;

  unlinkFromAccount(teacherId: string): Promise<void>;

  bulkUpsert(teachers: TeacherImportRow[], mode: ImportMode): Promise<ImportResult>;
}
