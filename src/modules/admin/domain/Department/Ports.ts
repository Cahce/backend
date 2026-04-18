/**
 * Department Repository Port
 * 
 * Domain interface for Department data access operations.
 * Infrastructure layer will provide the concrete implementation.
 * No framework dependencies.
 */

import type { Department, DepartmentWithContext, CreateDepartmentData, UpdateDepartmentData, DepartmentFilters } from './Types.js';
import type { PaginatedResult } from '../shared/Pagination.js';

/**
 * Department repository interface
 * 
 * Defines data access operations for Department entities.
 * Infrastructure layer (DepartmentRepoPrisma) will implement this interface.
 */
export interface DepartmentRepo {
  /**
   * Create a new Department
   * @param data - Department creation data
   * @returns Created Department entity
   */
  create(data: CreateDepartmentData): Promise<Department>;

  /**
   * Find Department by ID with enriched context
   * @param id - Department ID
   * @returns Department entity with Faculty context, or null if not found
   */
  findById(id: string): Promise<DepartmentWithContext | null>;

  /**
   * Find Department by code
   * Used for duplicate code checking during create/update
   * @param code - Department code
   * @returns Department entity or null if not found
   */
  findByCode(code: string): Promise<Department | null>;

  /**
   * Find all Departments with optional filters and enriched context
   * Results are ordered by updatedAt descending (newest first)
   * @param filters - Search, Faculty filter, and pagination filters
   * @returns Paginated list of Department entities with Faculty context
   */
  findAll(filters: DepartmentFilters): Promise<PaginatedResult<DepartmentWithContext>>;

  /**
   * Update an existing Department
   * @param id - Department ID
   * @param data - Department update data
   * @returns Updated Department entity
   */
  update(id: string, data: UpdateDepartmentData): Promise<Department>;

  /**
   * Delete a Department
   * Should only be called after checking deletion policies
   * @param id - Department ID
   */
  delete(id: string): Promise<void>;

  /**
   * Check if Department has any linked Teachers
   * Used by deletion policy to prevent orphaned data
   * 
   * TEMPORARY Phase 1 placeholder: Returns false until Phase 2 introduces TeacherProfile
   * 
   * @param id - Department ID
   * @returns True if Department has Teachers
   */
  hasLinkedTeachers(id: string): Promise<boolean>;
}
