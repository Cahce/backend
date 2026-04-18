/**
 * File Repository Port
 * 
 * Domain interface for File data access operations.
 * Infrastructure layer will provide the concrete implementation.
 * No framework dependencies.
 */

import type { File, CreateFileData, UpdateFileData, RenameFileData } from './Types.js';

/**
 * File repository interface
 * 
 * Defines data access operations for File entities.
 * Infrastructure layer (FileRepoPrisma) will implement this interface.
 */
export interface FileRepo {
  /**
   * Create a new File
   * @param data - File creation data with computed fields
   * @returns Created File entity
   */
  create(data: CreateFileData & { storageMode: string; sizeBytes: number; sha256: string }): Promise<File>;

  /**
   * Find File by ID
   * @param id - File ID
   * @returns File entity or null if not found
   */
  findById(id: string): Promise<File | null>;

  /**
   * Find File by project ID and path
   * @param projectId - Project ID
   * @param path - File path
   * @returns File entity or null if not found
   */
  findByProjectIdAndPath(projectId: string, path: string): Promise<File | null>;

  /**
   * List all Files in a project
   * Results are ordered by path alphabetically
   * @param projectId - Project ID
   * @returns List of File entities
   */
  listByProjectId(projectId: string): Promise<File[]>;

  /**
   * Update an existing File
   * @param data - File update data with computed fields
   * @returns Updated File entity
   */
  update(data: UpdateFileData & { sizeBytes: number; sha256: string }): Promise<File>;

  /**
   * Rename a File
   * @param data - File rename data
   * @returns Renamed File entity
   */
  rename(data: RenameFileData): Promise<File>;

  /**
   * Delete a File
   * @param projectId - Project ID
   * @param path - File path
   */
  delete(projectId: string, path: string): Promise<void>;

  /**
   * Find files for compilation
   * Returns files with kind: typst, bib, image, or data
   * @param projectId - Project ID
   * @returns List of File entities suitable for compilation
   */
  findForCompilation(projectId: string): Promise<File[]>;
}
