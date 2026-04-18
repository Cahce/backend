/**
 * Project Repository Port
 * 
 * Domain interface for Project data access operations.
 * Infrastructure layer will provide the concrete implementation.
 * No framework dependencies.
 */

import type { Project, CreateProjectData, UpdateProjectData } from './Types.js';

/**
 * Project repository interface
 * 
 * Defines data access operations for Project entities.
 * Infrastructure layer (ProjectRepoPrisma) will implement this interface.
 */
export interface ProjectRepo {
  /**
   * Create a new Project
   * @param data - Project creation data
   * @returns Created Project entity
   */
  create(data: CreateProjectData): Promise<Project>;

  /**
   * Find Project by ID
   * @param id - Project ID
   * @returns Project entity or null if not found
   */
  findById(id: string): Promise<Project | null>;

  /**
   * Find all Projects owned by a user
   * Results are ordered by updatedAt descending (most recently updated first)
   * @param ownerId - User ID
   * @returns List of Project entities
   */
  listByOwnerId(ownerId: string): Promise<Project[]>;

  /**
   * Update an existing Project
   * @param data - Project update data
   * @returns Updated Project entity
   */
  update(data: UpdateProjectData): Promise<Project>;

  /**
   * Delete a Project
   * Database cascade will handle File record removal
   * @param projectId - Project ID
   */
  delete(projectId: string): Promise<void>;
}
