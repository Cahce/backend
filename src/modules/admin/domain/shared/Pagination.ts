/**
 * Domain-safe Pagination Types
 * 
 * Generic pagination types for domain operations.
 * No framework dependencies, no application layer dependencies.
 */

/**
 * Pagination parameters for list queries
 */
export type PaginationParams = {
  page?: number;
  pageSize?: number;
};

/**
 * Paginated result for list queries
 */
export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
