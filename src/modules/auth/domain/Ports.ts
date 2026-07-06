
import type { UserRole } from "../../../shared/auth/Types.js";

export interface AuthUser {
    id: string;
    email: string;
    role: UserRole;
    passwordHash: string;
    isActive: boolean;
    mustChangePassword: boolean;
}

export interface IUserRepository {
    findByEmail(email: string): Promise<AuthUser | null>;
    findById(id: string): Promise<AuthUser | null>;
    updatePassword(userId: string, newPasswordHash: string): Promise<void>;
}

export interface IPasswordHasher {
    verify(plainPassword: string, hash: string): Promise<boolean>;
    hash(plainPassword: string): Promise<string>;
}

export interface ITokenService {
    generateAccessToken(payload: { userId: string; email: string; role: UserRole }): Promise<{
        token: string;
        jti: string;
        expiresAt: Date;
    }>;
    generateRefreshToken(): { token: string; expiresAt: Date };
    hashRefreshToken(token: string): string;
}

export interface ITokenRevocationRepository {
    revoke(jti: string, userId: string, expiresAt: Date): Promise<void>;
    isRevoked(jti: string): Promise<boolean>;
}

export interface RefreshTokenRow {
    id: string;
    userId: string;
    familyId: string;
    expiresAt: Date;
    revokedAt: Date | null;
}

export interface IRefreshTokenRepository {
    persist(p: {
        tokenHash: string;
        userId: string;
        familyId: string;
        expiresAt: Date;
    }): Promise<{ id: string }>;
    findByHash(tokenHash: string): Promise<RefreshTokenRow | null>;
    rotate(
        oldId: string,
        next: { tokenHash: string; familyId: string; expiresAt: Date; userId: string },
    ): Promise<void>;
    revokeFamily(familyId: string): Promise<void>;
    revokeByHash(tokenHash: string): Promise<void>;
    deleteExpired(now: Date): Promise<number>;
}
