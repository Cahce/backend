import type { ITokenRevocationRepository } from "../domain/Ports.js";
import type { TokenRevocationCachePort } from "../../../shared/auth/TokenRevocationCachePort.js";
import { AuthError, InternalAuthError } from "../domain/AuthErrors.js";

/**
 * Logout use case
 * Revokes the current JWT token
 */

export interface LogoutCommand {
    jti: string;
    userId: string;
}

export interface LogoutResult {
    success: true;
    message: string;
}

export interface LogoutFailure {
    success: false;
    error: {
        code: string;
        message: string;
    };
}

export type LogoutResponse = LogoutResult | LogoutFailure;

export class LogoutUseCase {
    constructor(
        private readonly tokenRevocationRepo: ITokenRevocationRepository,
        private readonly tokenRevocationCache?: TokenRevocationCachePort,
    ) {}

    async execute(command: LogoutCommand): Promise<LogoutResponse> {
        try {
            // Calculate token expiration (tokens expire in 1 day by default)
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 1);

            // Revoke the token (DB write — source of truth)
            await this.tokenRevocationRepo.revoke(command.jti, command.userId, expiresAt);

            // Invalidate cache immediately so subsequent `verify()` doesn't
            // serve stale `valid` until TTL expires. Seed `revoked` sentinel
            // to also short-circuit DB lookup in the meantime.
            this.tokenRevocationCache?.set(command.jti, "revoked");

            return {
                success: true,
                message: "Đăng xuất thành công",
            };
        } catch (error) {
            // Handle domain errors
            if (error instanceof AuthError) {
                return {
                    success: false,
                    error: {
                        code: error.code,
                        message: error.message,
                    },
                };
            }

            // Handle unexpected errors
            console.error("Logout error:", error);
            const internalError = new InternalAuthError("Đăng xuất thất bại");
            return {
                success: false,
                error: {
                    code: internalError.code,
                    message: internalError.message,
                },
            };
        }
    }
}
