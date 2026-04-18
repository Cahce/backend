import type { PrismaClient } from "../../../generated/prisma/index.js";
import type { ITokenRevocationRepository } from "../domain/Ports.js";

/**
 * Prisma implementation of token revocation repository
 */
export class TokenRevocationRepoPrisma implements ITokenRevocationRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async revoke(jti: string, userId: string, expiresAt: Date): Promise<void> {
        await this.prisma.invalidToken.create({
            data: {
                jti,
                userId,
                expiresAt,
            },
        });
    }

    async isRevoked(jti: string): Promise<boolean> {
        const token = await this.prisma.invalidToken.findUnique({
            where: { jti },
        });
        return token !== null;
    }
}
