/**
 * Auth domain — user profile read-model + query port.
 *
 * `UserWithProfile` is a domain-owned read model returned by the
 * {@link IUserProfileQuery} port. Keeping it here (not in application/infra)
 * lets the use case depend on a domain abstraction instead of Prisma.
 * No framework dependencies.
 */

import type { UserRole } from "../../../shared/auth/Types.js";

/**
 * Faculty context shared by student/teacher profile read models.
 */
export interface ProfileFaculty {
    id: string;
    name: string;
    code: string;
}

/** Mirrors the Prisma `Gender` enum without importing Prisma into the domain. */
export type ProfileGender = "male" | "female" | "other";

/**
 * Complete user information including the role-specific profile.
 */
export interface UserWithProfile {
    id: string;
    email: string;
    role: UserRole;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;

    // Student profile (only when role is student)
    studentProfile?: {
        id: string;
        studentCode: string;
        fullName: string;
        phone: string | null;
        gender: ProfileGender | null;
        dateOfBirth: Date | null;
        address: string | null;
        class: {
            id: string;
            name: string;
            code: string;
            major: {
                id: string;
                name: string;
                code: string;
                faculty: ProfileFaculty;
            };
        };
    };

    // Teacher profile (only when role is teacher)
    teacherProfile?: {
        id: string;
        teacherCode: string;
        fullName: string;
        phone: string | null;
        gender: ProfileGender | null;
        dateOfBirth: Date | null;
        address: string | null;
        academicRank: string;
        academicDegree: string;
        department: {
            id: string;
            name: string;
            code: string;
            faculty: ProfileFaculty;
        };
    };
}

/**
 * Query port for reading a user together with their role-specific profile in a
 * single round-trip. Implemented by infra (Prisma); the application use case
 * depends only on this interface.
 */
export interface IUserProfileQuery {
    findByEmailWithProfile(email: string): Promise<UserWithProfile | null>;
}

/**
 * Personal fields a student/teacher may edit on their OWN profile. Identity and
 * academic fields (code, name, class, department, rank, degree) stay
 * admin-managed and are intentionally excluded.
 */
export interface UpdateOwnProfileData {
    gender?: ProfileGender | null;
    dateOfBirth?: Date | null;
    phone?: string | null;
    address?: string | null;
}

/**
 * The personal fields echoed back after a successful self-update.
 */
export interface OwnProfilePersonal {
    gender: ProfileGender | null;
    dateOfBirth: Date | null;
    phone: string | null;
    address: string | null;
}

/**
 * Mutation port for a user updating their OWN role-specific profile. Only
 * `student` and `teacher` roles have an editable profile. Implemented by infra
 * (Prisma); throws `PROFILE_NOT_LINKED` when the account has no profile record.
 */
export interface IUserProfileMutation {
    updateOwnProfile(
        accountId: string,
        role: UserRole,
        data: UpdateOwnProfileData,
    ): Promise<OwnProfilePersonal>;
}
