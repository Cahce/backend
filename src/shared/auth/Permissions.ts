/**
 * RBAC permission catalog
 *
 * Single source of truth for capability-level authorization.
 * Permissions are derived from a user's role (not stored per-user / not in the JWT),
 * so policy changes never require reissuing tokens and the token stays small.
 *
 * Pure module: no Fastify / Prisma / framework imports (lives in `shared`).
 */

import type { UserRole } from "./Types.js";

/**
 * Permission identifiers, namespaced as `resource:action`.
 * Keep this list aligned with the actual product surfaces (routes / sidebar).
 */
export const PERMISSIONS = [
    // Admin area
    "admin:access",
    "users:manage",
    "students:manage",
    "teachers:manage",
    "academic:manage",
    "templates:manage",
    "admin:projects:oversee",
    // Author area (student / teacher)
    "projects:create",
    "projects:read",
    "projects:edit",
    "editor:access",
    // Teacher
    "advising:view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Role → permission mapping. The authoritative RBAC policy.
 */
const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
    admin: [
        "admin:access",
        "users:manage",
        "students:manage",
        "teachers:manage",
        "academic:manage",
        "templates:manage",
        "admin:projects:oversee",
    ],
    teacher: [
        "projects:create",
        "projects:read",
        "projects:edit",
        "editor:access",
        "advising:view",
    ],
    student: [
        "projects:create",
        "projects:read",
        "projects:edit",
        "editor:access",
    ],
};

/**
 * Returns the (copied) list of permissions granted to a role.
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
    return [...(ROLE_PERMISSIONS[role] ?? [])];
}

/**
 * Returns true if the role grants the given permission.
 */
export function roleHasPermission(role: UserRole, permission: Permission): boolean {
    return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}
