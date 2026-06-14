/**
 * Domain ports (interfaces) for auth module
 */

import type { UserRole } from "../../../shared/auth/Types.js";

export interface UserDto {
    id: string;
    email: string;
    role: UserRole;
    passwordHash: string;
    isActive: boolean;
    mustChangePassword: boolean;
}

export interface IUserRepository {
    findByEmail(email: string): Promise<UserDto | null>;
    findById(id: string): Promise<UserDto | null>;
    updatePassword(userId: string, newPasswordHash: string): Promise<void>;
}

export interface IPasswordHasher {
    verify(plainPassword: string, hash: string): Promise<boolean>;
    hash(plainPassword: string): Promise<string>;
}

export interface ITokenService {
    /** Sign a short-lived access token (carries `exp`). Returns the token plus its `jti` and absolute expiry. */
    generateAccessToken(payload: {
        userId: string;
        email: string;
        role: UserRole;
    }): Promise<{ token: string; jti: string; expiresAt: Date }>;
    /** Mint an opaque (non-JWT) refresh token + its absolute expiry. */
    generateRefreshToken(): { token: string; expiresAt: Date };
    /** Hash a refresh token for at-rest storage / lookup (never store plaintext). */
    hashRefreshToken(token: string): string;
}

export interface ITokenRevocationRepository {
    revoke(jti: string, userId: string, expiresAt: Date): Promise<void>;
    isRevoked(jti: string): Promise<boolean>;
}

/** A persisted refresh-token row (hash only; never the plaintext token). */
export interface RefreshTokenRow {
    id: string;
    userId: string;
    tokenHash: string;
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
    /** Atomically revoke `oldId` (marking `replacedBy`) and insert the rotated token. */
    rotate(
        oldId: string,
        next: { tokenHash: string; familyId: string; expiresAt: Date; userId: string },
    ): Promise<{ id: string }>;
    /** Revoke every still-active token in a rotation family (logout / theft response). */
    revokeFamily(familyId: string): Promise<void>;
    revokeByHash(tokenHash: string): Promise<void>;
    /** Delete rows whose `expiresAt` is in the past. Returns the deleted count. */
    deleteExpired(now: Date): Promise<number>;
}
