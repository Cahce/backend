/**
 * Class Domain Types
 * 
 * Pure domain types for Class entity - no framework dependencies.
 */

import type { Major } from '../Major/Types.js';
import type { Faculty } from '../Faculty/Types.js';

/**
 * Class entity representing an academic class
 * Belongs to Major, used for organizing students
 */
export type Class = {
  id: string;
  name: string;
  code: string;
  majorId: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Class with enriched context for query responses
 * Includes parent hierarchy (Major and Faculty)
 */
export type ClassWithContext = Class & {
  major?: Major;
  faculty?: Faculty;
};

/**
 * Data required to create a new Class
 */
export type CreateClassData = {
  name: string;
  code: string;
  majorId: string;
};

/**
 * Data that can be updated for an existing Class
 */
export type UpdateClassData = {
  name?: string;
  code?: string;
  majorId?: string;
};

/**
 * Filters for querying Class list
 * Results are ordered by updatedAt descending (newest first)
 */
export type ClassFilters = {
  search?: string;      // Search in name or code
  majorId?: string;     // Filter by Major
  facultyId?: string;   // Filter by Faculty (via Major)
  page?: number;        // Page number (1-indexed)
  pageSize?: number;    // Items per page
};
