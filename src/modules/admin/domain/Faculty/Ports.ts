
import type { Faculty, CreateFacultyData, UpdateFacultyData, FacultyFilters } from './Types.js';
import type { PaginatedResult } from '../shared/Pagination.js';

export interface FacultyRepo {
  create(data: CreateFacultyData): Promise<Faculty>;

  findById(id: string): Promise<Faculty | null>;

  findByCode(code: string): Promise<Faculty | null>;

  findAll(filters: FacultyFilters): Promise<PaginatedResult<Faculty>>;

  update(id: string, data: UpdateFacultyData): Promise<Faculty>;

  delete(id: string): Promise<void>;

  hasChildDepartments(id: string): Promise<boolean>;

  hasChildMajors(id: string): Promise<boolean>;
}
