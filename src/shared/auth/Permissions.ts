
import type { UserRole } from "./Types.js";

export const PERMISSIONS = [
    "admin:access",
    "users:manage",
    "students:manage",
    "teachers:manage",
    "academic:manage",
    "templates:manage",
    "admin:projects:oversee",
    "projects:create",
    "projects:read",
    "projects:edit",
    "editor:access",
    "advising:view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

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

export function getPermissionsForRole(role: UserRole): Permission[] {
    return [...(ROLE_PERMISSIONS[role] ?? [])];
}

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
    return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}
