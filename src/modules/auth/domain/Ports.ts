/**
 * Domain ports (interfaces) for auth module
 */

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
    /** Sign a short-lived access JWT. Returns the token, its `jti`, and `exp`. */
    generateAccessToken(payload: { userId: string; email: string; role: UserRole }): Promise<{
        token: string;
        jti: string;
        expiresAt: Date;
    }>;
    /** Create an opaque (non-JWT) refresh token + its computed expiry. */
    generateRefreshToken(): { token: string; expiresAt: Date };
    /** SHA-256 hex hash of a refresh token (only the hash is stored at rest). */
    hashRefreshToken(token: string): string;
}

export interface ITokenRevocationRepository {
    revoke(jti: string, userId: string, expiresAt: Date): Promise<void>;
    isRevoked(jti: string): Promise<boolean>;
}

/**
 * A persisted refresh-token row (only the hash is stored, never the token).
 */
export interface RefreshTokenRow {
    id: string;
    userId: string;
    familyId: string;
    expiresAt: Date;
    revokedAt: Date | null;
}

/**
 * Refresh-token store. Rotating + one-time-use: every successful refresh
 * rotates the token (old revoked, new inserted in the same family); reuse of a
 * revoked token burns the whole family (theft containment).
 */
export interface IRefreshTokenRepository {
    persist(p: {
        tokenHash: string;
        userId: string;
        familyId: string;
        expiresAt: Date;
    }): Promise<{ id: string }>;
    findByHash(tokenHash: string): Promise<RefreshTokenRow | null>;
    /** Revoke `oldId` and insert the next token (same family) atomically. */
    rotate(
        oldId: string,
        next: { tokenHash: string; familyId: string; expiresAt: Date; userId: string },
    ): Promise<void>;
    revokeFamily(familyId: string): Promise<void>;
    revokeByHash(tokenHash: string): Promise<void>;
    deleteExpired(now: Date): Promise<number>;
}
