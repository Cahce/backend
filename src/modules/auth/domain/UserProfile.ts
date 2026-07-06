
import type { UserRole } from "../../../shared/auth/Types.js";

export interface ProfileFaculty {
    id: string;
    name: string;
    code: string;
}

export type ProfileGender = "male" | "female" | "other";

export interface UserWithProfile {
    id: string;
    email: string;
    role: UserRole;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;

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

export interface IUserProfileQuery {
    findByEmailWithProfile(email: string): Promise<UserWithProfile | null>;
}

export interface UpdateOwnProfileData {
    gender?: ProfileGender | null;
    dateOfBirth?: Date | null;
    phone?: string | null;
    address?: string | null;
}

export interface OwnProfilePersonal {
    gender: ProfileGender | null;
    dateOfBirth: Date | null;
    phone: string | null;
    address: string | null;
}

export interface IUserProfileMutation {
    updateOwnProfile(
        accountId: string,
        role: UserRole,
        data: UpdateOwnProfileData,
    ): Promise<OwnProfilePersonal>;
}
