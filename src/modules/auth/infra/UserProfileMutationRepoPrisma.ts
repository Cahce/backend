
import type { PrismaClient } from "../../../generated/prisma/index.js";
import { Prisma } from "../../../generated/prisma/index.js";
import type {
    IUserProfileMutation,
    OwnProfilePersonal,
    UpdateOwnProfileData,
} from "../domain/UserProfile.js";
import type { UserRole } from "../../../shared/auth/Types.js";

export class UserProfileMutationRepoPrisma implements IUserProfileMutation {
    constructor(private readonly prisma: PrismaClient) {}

    async updateOwnProfile(
        accountId: string,
        role: UserRole,
        data: UpdateOwnProfileData,
    ): Promise<OwnProfilePersonal> {
        const patch = {
            ...(data.gender !== undefined && { gender: data.gender }),
            ...(data.dateOfBirth !== undefined && { dateOfBirth: data.dateOfBirth }),
            ...(data.phone !== undefined && { phone: data.phone }),
            ...(data.address !== undefined && { address: data.address }),
        };

        const select = {
            gender: true,
            dateOfBirth: true,
            phone: true,
            address: true,
        } as const;

        try {
            if (role === "student") {
                return await this.prisma.student.update({
                    where: { accountId },
                    data: patch,
                    select,
                });
            }
            if (role === "teacher") {
                return await this.prisma.teacher.update({
                    where: { accountId },
                    data: patch,
                    select,
                });
            }
            throw new Error("PROFILE_NOT_EDITABLE");
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2025"
            ) {
                throw new Error("PROFILE_NOT_LINKED");
            }
            throw error;
        }
    }
}
