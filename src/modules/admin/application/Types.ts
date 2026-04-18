/**
 * Shared Application Types
 * 
 * Common types used across all use cases in the admin module.
 * Re-exports domain-safe types for convenience.
 */

// Re-export domain-safe types
export type { Result } from '../domain/shared/Result.js';
export type { PaginatedResult, PaginationParams } from '../domain/shared/Pagination.js';
export { success, failure } from '../domain/shared/Result.js';
