/**
 * Faculty Repository Port
 * 
 * Domain interface for Faculty data access operations.
 * Infrastructure layer will provide the concrete implementation.
 * No framework dependencies.
 */

import type { Faculty, CreateFacultyData, UpdateFacultyData, FacultyFilters } from './Types.js';
import type { PaginatedResult } from '../shared/Pagination.js';

/**
 * Faculty repository interface
 * 
 * Defines data access operations for Faculty entities.
 * Infrastructure layer (FacultyRepoPrisma) will implement this interface.
 */
export interface FacultyRepo {
  /**
   * Create a new Faculty
   * @param data - Faculty creation data
   * @returns Created Faculty entity
   */
  create(data: CreateFacultyData): Promise<Faculty>;

  /**
   * Find Faculty by ID
   * @param id - Faculty ID
   * @returns Faculty entity or null if not found
   */
  findById(id: string): Promise<Faculty | null>;

  /**
   * Find Faculty by code
   * Used for duplicate code checking during create/update
   * @param code - Faculty code
   * @returns Faculty entity or null if not found
   */
  findByCode(code: string): Promise<Faculty | null>;

  /**
   * Find all Faculties with optional filters
   * Results are ordered by updatedAt descending (newest first)
   * @param filters - Search and pagination filters
   * @returns Paginated list of Faculty entities
   */
  findAll(filters: FacultyFilters): Promise<PaginatedResult<Faculty>>;

  /**
   * Update an existing Faculty
   * @param id - Faculty ID
   * @param data - Faculty update data
   * @returns Updated Faculty entity
   */
  update(id: string, data: UpdateFacultyData): Promise<Faculty>;

  /**
   * Delete a Faculty
   * Should only be called after checking deletion policies
   * @param id - Faculty ID
   */
  delete(id: string): Promise<void>;

  /**
   * Check if Faculty has any child Departments
   * Used by deletion policy to prevent orphaned data
   * @param id - Faculty ID
   * @returns True if Faculty has Departments
   */
  hasChildDepartments(id: string): Promise<boolean>;

  /**
   * Check if Faculty has any child Majors
   * Used by deletion policy to prevent orphaned data
   * @param id - Faculty ID
   * @returns True if Faculty has Majors
   */
  hasChildMajors(id: string): Promise<boolean>;
}
