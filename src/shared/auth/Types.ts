/**
 * Shared auth types
 * Re-exports UserRole from Prisma for use across the application
 */

import { UserRole as PrismaUserRole } from "../../generated/prisma/index.js";

/**
 * User role enum
 * - admin: Full system access
 * - teacher: Teacher-specific features
 * - student: Student-specific features
 */
export type UserRole = PrismaUserRole;

/**
 * UserRole constant for runtime checks
 */
export const UserRole = {
    ADMIN: "admin" as const,
    TEACHER: "teacher" as const,
    STUDENT: "student" as const,
} as const;

/**
 * Helper to check if a value is a valid UserRole
 */
export function isValidUserRole(value: unknown): value is UserRole {
    return (
        value === UserRole.ADMIN ||
        value === UserRole.TEACHER ||
        value === UserRole.STUDENT
    );
}
