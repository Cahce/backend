
import type { Department, DepartmentWithContext, CreateDepartmentData, UpdateDepartmentData, DepartmentFilters } from './Types.js';
import type { PaginatedResult } from '../shared/Pagination.js';

export interface DepartmentRepo {
  create(data: CreateDepartmentData): Promise<Department>;

  findById(id: string): Promise<DepartmentWithContext | null>;

  findByCode(code: string): Promise<Department | null>;

  findAll(filters: DepartmentFilters): Promise<PaginatedResult<DepartmentWithContext>>;

  update(id: string, data: UpdateDepartmentData): Promise<Department>;

  delete(id: string): Promise<void>;

  hasLinkedTeachers(id: string): Promise<boolean>;
}
