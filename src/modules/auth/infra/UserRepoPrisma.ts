import type { PrismaClient } from "../../../generated/prisma/index.js";
import type { IUserRepository, AuthUser } from "../domain/Ports.js";

/**
 * Prisma implementation of user repository
 */
export class UserRepoPrisma implements IUserRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async findByEmail(email: string): Promise<AuthUser | null> {
        const user = await this.prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                role: true,
                passwordHash: true,
                isActive: true,
                mustChangePassword: true,
            },
        });

        if (!user) {
            return null;
        }

        return {
            id: user.id,
            email: user.email,
            role: user.role,
            passwordHash: user.passwordHash,
            isActive: user.isActive,
            mustChangePassword: user.mustChangePassword,
        };
    }

    async findById(id: string): Promise<AuthUser | null> {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                role: true,
                passwordHash: true,
                isActive: true,
                mustChangePassword: true,
            },
        });

        if (!user) {
            return null;
        }

        return {
            id: user.id,
            email: user.email,
            role: user.role,
            passwordHash: user.passwordHash,
            isActive: user.isActive,
            mustChangePassword: user.mustChangePassword,
        };
    }

    async updatePassword(userId: string, newPasswordHash: string): Promise<void> {
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                passwordHash: newPasswordHash,
                // After a successful change the forced-change requirement is satisfied.
                mustChangePassword: false,
                passwordChangedAt: new Date(),
            },
        });
    }
}
