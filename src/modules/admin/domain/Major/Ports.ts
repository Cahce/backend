
import type { Major, MajorWithContext, CreateMajorData, UpdateMajorData, MajorFilters } from './Types.js';
import type { PaginatedResult } from '../shared/Pagination.js';

export interface MajorRepo {
  create(data: CreateMajorData): Promise<Major>;

  findById(id: string): Promise<MajorWithContext | null>;

  findByCode(code: string): Promise<Major | null>;

  findAll(filters: MajorFilters): Promise<PaginatedResult<MajorWithContext>>;

  update(id: string, data: UpdateMajorData): Promise<Major>;

  delete(id: string): Promise<void>;

  hasChildClasses(id: string): Promise<boolean>;
}
