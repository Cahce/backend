import type { PrismaClient } from "../../../generated/prisma/index.js";
import type { IRefreshTokenRepository, RefreshTokenRow } from "../domain/Ports.js";

/**
 * Prisma implementation of the refresh-token repository.
 * Stores only the SHA-256 hash of each opaque refresh token.
 */
export class RefreshTokenRepoPrisma implements IRefreshTokenRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async persist(p: {
        tokenHash: string;
        userId: string;
        familyId: string;
        expiresAt: Date;
    }): Promise<{ id: string }> {
        const row = await this.prisma.refreshToken.create({
            data: {
                tokenHash: p.tokenHash,
                userId: p.userId,
                familyId: p.familyId,
                expiresAt: p.expiresAt,
            },
            select: { id: true },
        });
        return { id: row.id };
    }

    async findByHash(tokenHash: string): Promise<RefreshTokenRow | null> {
        return this.prisma.refreshToken.findUnique({
            where: { tokenHash },
            select: {
                id: true,
                userId: true,
                tokenHash: true,
                familyId: true,
                expiresAt: true,
                revokedAt: true,
            },
        });
    }

    async rotate(
        oldId: string,
        next: { tokenHash: string; familyId: string; expiresAt: Date; userId: string },
    ): Promise<{ id: string }> {
        return this.prisma.$transaction(async (tx) => {
            const created = await tx.refreshToken.create({
                data: {
                    tokenHash: next.tokenHash,
                    userId: next.userId,
                    familyId: next.familyId,
                    expiresAt: next.expiresAt,
                },
                select: { id: true },
            });
            await tx.refreshToken.update({
                where: { id: oldId },
                data: { revokedAt: new Date(), replacedBy: created.id },
            });
            return { id: created.id };
        });
    }

    async revokeFamily(familyId: string): Promise<void> {
        await this.prisma.refreshToken.updateMany({
            where: { familyId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }

    async revokeByHash(tokenHash: string): Promise<void> {
        await this.prisma.refreshToken.updateMany({
            where: { tokenHash, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }

    async deleteExpired(now: Date): Promise<number> {
        const result = await this.prisma.refreshToken.deleteMany({
            where: { expiresAt: { lt: now } },
        });
        return result.count;
    }
}
