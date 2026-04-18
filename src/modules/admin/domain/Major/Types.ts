/**
 * Major Domain Types
 * 
 * Pure domain types for Major entity - no framework dependencies.
 */

import type { Faculty } from '../Faculty/Types.js';

/**
 * Major entity representing an academic major/program
 * Belongs to Faculty, used for organizing students
 */
export type Major = {
  id: string;
  name: string;
  code: string;
  facultyId: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Major with enriched context for query responses
 * Includes parent Faculty
 */
export type MajorWithContext = Major & {
  faculty?: Faculty;
};

/**
 * Data required to create a new Major
 */
export type CreateMajorData = {
  name: string;
  code: string;
  facultyId: string;
};

/**
 * Data that can be updated for an existing Major
 */
export type UpdateMajorData = {
  name?: string;
  code?: string;
  facultyId?: string;
};

/**
 * Filters for querying Major list
 * Results are ordered by updatedAt descending (newest first)
 */
export type MajorFilters = {
  search?: string;      // Search in name or code
  facultyId?: string;   // Filter by Faculty
  page?: number;        // Page number (1-indexed)
  pageSize?: number;    // Items per page
};
