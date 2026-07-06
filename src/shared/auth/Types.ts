
import { UserRole as PrismaUserRole } from "../../generated/prisma/index.js";

export type UserRole = PrismaUserRole;

export const UserRole = {
    ADMIN: "admin" as const,
    TEACHER: "teacher" as const,
    STUDENT: "student" as const,
} as const;

export function isValidUserRole(value: unknown): value is UserRole {
    return (
        value === UserRole.ADMIN ||
        value === UserRole.TEACHER ||
        value === UserRole.STUDENT
    );
}
