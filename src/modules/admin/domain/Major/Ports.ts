/**
 * Major Repository Port
 * 
 * Domain interface for Major data access operations.
 * Infrastructure layer will provide the concrete implementation.
 * No framework dependencies.
 */

import type { Major, MajorWithContext, CreateMajorData, UpdateMajorData, MajorFilters } from './Types.js';
import type { PaginatedResult } from '../shared/Pagination.js';

/**
 * Major repository interface
 * 
 * Defines data access operations for Major entities.
 * Infrastructure layer (MajorRepoPrisma) will implement this interface.
 */
export interface MajorRepo {
  /**
   * Create a new Major
   * @param data - Major creation data
   * @returns Created Major entity
   */
  create(data: CreateMajorData): Promise<Major>;

  /**
   * Find Major by ID with enriched context
   * @param id - Major ID
   * @returns Major entity with Faculty context, or null if not found
   */
  findById(id: string): Promise<MajorWithContext | null>;

  /**
   * Find Major by code
   * Used for duplicate code checking during create/update
   * @param code - Major code
   * @returns Major entity or null if not found
   */
  findByCode(code: string): Promise<Major | null>;

  /**
   * Find all Majors with optional filters and enriched context
   * Results are ordered by updatedAt descending (newest first)
   * @param filters - Search, Faculty filter, and pagination filters
   * @returns Paginated list of Major entities with Faculty context
   */
  findAll(filters: MajorFilters): Promise<PaginatedResult<MajorWithContext>>;

  /**
   * Update an existing Major
   * @param id - Major ID
   * @param data - Major update data
   * @returns Updated Major entity
   */
  update(id: string, data: UpdateMajorData): Promise<Major>;

  /**
   * Delete a Major
   * Should only be called after checking deletion policies
   * @param id - Major ID
   */
  delete(id: string): Promise<void>;

  /**
   * Check if Major has any child AcademicClasses
   * Used by deletion policy to prevent orphaned data
   * @param id - Major ID
   * @returns True if Major has AcademicClasses
   */
  hasChildClasses(id: string): Promise<boolean>;
}
