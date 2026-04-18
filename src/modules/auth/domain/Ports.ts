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
    generate(payload: { userId: string; email: string; role: UserRole }): Promise<string>;
}

export interface ITokenRevocationRepository {
    revoke(jti: string, userId: string, expiresAt: Date): Promise<void>;
    isRevoked(jti: string): Promise<boolean>;
}
