/**
 * Class Repository Port
 * 
 * Domain interface for Class data access operations.
 * Infrastructure layer will provide the concrete implementation.
 * No framework dependencies.
 */

import type { Class, ClassWithContext, CreateClassData, UpdateClassData, ClassFilters } from './Types.js';
import type { PaginatedResult } from '../shared/Pagination.js';

/**
 * Class repository interface
 * 
 * Defines data access operations for Class entities.
 * Infrastructure layer (ClassRepoPrisma) will implement this interface.
 */
export interface ClassRepo {
  /**
   * Create a new Class
   * @param data - Class creation data
   * @returns Created Class entity
   */
  create(data: CreateClassData): Promise<Class>;

  /**
   * Find Class by ID with enriched context
   * @param id - Class ID
   * @returns Class entity with Major and Faculty context, or null if not found
   */
  findById(id: string): Promise<ClassWithContext | null>;

  /**
   * Find Class by code
   * Used for duplicate code checking during create/update
   * @param code - Class code
   * @returns Class entity or null if not found
   */
  findByCode(code: string): Promise<Class | null>;

  /**
   * Find all Classes with optional filters and enriched context
   * Results are ordered by updatedAt descending (newest first)
   * @param filters - Search, Major/Faculty filter, and pagination filters
   * @returns Paginated list of Class entities with Major and Faculty context
   */
  findAll(filters: ClassFilters): Promise<PaginatedResult<ClassWithContext>>;

  /**
   * Update an existing Class
   * @param id - Class ID
   * @param data - Class update data
   * @returns Updated Class entity
   */
  update(id: string, data: UpdateClassData): Promise<Class>;

  /**
   * Delete a Class
   * Should only be called after checking deletion policies
   * @param id - Class ID
   */
  delete(id: string): Promise<void>;

  /**
   * Check if Class has any linked Students
   * Used by deletion policy to prevent orphaned data
   * 
   * TEMPORARY Phase 1 placeholder: Returns false until Phase 2 introduces StudentProfile
   * 
   * @param id - Class ID
   * @returns True if Class has Students
   */
  hasLinkedStudents(id: string): Promise<boolean>;
}
