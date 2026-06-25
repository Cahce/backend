/**
 * Update Own Profile Use Case
 *
 * Lets the authenticated user edit the personal fields of their own
 * student/teacher profile. Depends only on the IUserProfileMutation domain
 * port — no Prisma in application. Identity/academic fields are not editable
 * here (admin-managed).
 */

import type {
    IUserProfileMutation,
    OwnProfilePersonal,
    UpdateOwnProfileData,
} from "../domain/UserProfile.js";
import type { UserRole } from "../../../shared/auth/Types.js";

export interface UpdateOwnProfileCommand {
    accountId: string;
    role: UserRole;
    data: UpdateOwnProfileData;
}

export interface UpdateOwnProfileSuccess {
    success: true;
    data: OwnProfilePersonal;
}

export interface UpdateOwnProfileFailure {
    success: false;
    error: {
        code: string;
        message: string;
    };
}

export type UpdateOwnProfileResponse =
    | UpdateOwnProfileSuccess
    | UpdateOwnProfileFailure;

export class UpdateOwnProfileUseCase {
    constructor(private readonly mutation: IUserProfileMutation) {}

    async execute(cmd: UpdateOwnProfileCommand): Promise<UpdateOwnProfileResponse> {
        if (cmd.role !== "student" && cmd.role !== "teacher") {
            return {
                success: false,
                error: {
                    code: "PROFILE_NOT_EDITABLE",
                    message: "Tài khoản này không có hồ sơ cá nhân để chỉnh sửa",
                },
            };
        }

        try {
            const updated = await this.mutation.updateOwnProfile(
                cmd.accountId,
                cmd.role,
                cmd.data,
            );
            return { success: true, data: updated };
        } catch (error) {
            if (error instanceof Error && error.message === "PROFILE_NOT_LINKED") {
                return {
                    success: false,
                    error: {
                        code: "PROFILE_NOT_LINKED",
                        message:
                            "Tài khoản chưa được liên kết với hồ sơ. Vui lòng liên hệ quản trị viên.",
                    },
                };
            }
            return {
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Lỗi khi cập nhật hồ sơ cá nhân",
                },
            };
        }
    }
}
