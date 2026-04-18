/**
 * Faculty Domain Types
 * 
 * Pure domain types for Faculty entity - no framework dependencies.
 */

/**
 * Faculty entity representing an academic faculty (top-level academic unit)
 */
export type Faculty = {
  id: string;
  name: string;
  code: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Data required to create a new Faculty
 */
export type CreateFacultyData = {
  name: string;
  code: string;
};

/**
 * Data that can be updated for an existing Faculty
 */
export type UpdateFacultyData = {
  name?: string;
  code?: string;
};

/**
 * Filters for querying Faculty list
 * Results are ordered by updatedAt descending (newest first)
 */
export type FacultyFilters = {
  search?: string;      // Search in name or code
  page?: number;        // Page number (1-indexed)
  pageSize?: number;    // Items per page
};
