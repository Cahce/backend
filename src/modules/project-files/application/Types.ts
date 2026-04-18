/**
 * Application Layer Types
 * 
 * Shared types for application layer operations.
 * No framework dependencies.
 */

/**
 * Result type for use case operations
 * Represents either success with data or failure with error details
 */
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

/**
 * Helper to create a success result
 */
export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

/**
 * Helper to create a failure result
 */
export function failure<T>(code: string, message: string): Result<T> {
  return { success: false, error: { code, message } };
}
