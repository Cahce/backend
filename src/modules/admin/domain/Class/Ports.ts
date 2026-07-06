
import type { Class, ClassWithContext, CreateClassData, UpdateClassData, ClassFilters } from './Types.js';
import type { PaginatedResult } from '../shared/Pagination.js';

export interface ClassRepo {
  create(data: CreateClassData): Promise<Class>;

  findById(id: string): Promise<ClassWithContext | null>;

  findByCode(code: string): Promise<Class | null>;

  findAll(filters: ClassFilters): Promise<PaginatedResult<ClassWithContext>>;

  update(id: string, data: UpdateClassData): Promise<Class>;

  delete(id: string): Promise<void>;

  hasLinkedStudents(id: string): Promise<boolean>;
}
