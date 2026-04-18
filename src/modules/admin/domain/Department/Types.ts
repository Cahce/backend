/**
 * Department Domain Types
 * 
 * Pure domain types for Department entity - no framework dependencies.
 */

import type { Faculty } from '../Faculty/Types.js';

/**
 * Department entity representing an academic department
 * Belongs to Faculty, used for organizing teachers
 */
export type Department = {
  id: string;
  name: string;
  code: string;
  facultyId: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Department with enriched context for query responses
 * Includes parent Faculty
 */
export type DepartmentWithContext = Department & {
  faculty?: Faculty;
};

/**
 * Data required to create a new Department
 */
export type CreateDepartmentData = {
  name: string;
  code: string;
  facultyId: string;
};

/**
 * Data that can be updated for an existing Department
 */
export type UpdateDepartmentData = {
  name?: string;
  code?: string;
  facultyId?: string;
};

/**
 * Filters for querying Department list
 * Results are ordered by updatedAt descending (newest first)
 */
export type DepartmentFilters = {
  search?: string;      // Search in name or code
  facultyId?: string;   // Filter by Faculty
  page?: number;        // Page number (1-indexed)
  pageSize?: number;    // Items per page
};
