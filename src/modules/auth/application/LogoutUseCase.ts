import type {
    IRefreshTokenRepository,
    ITokenRevocationRepository,
    ITokenService,
} from "../domain/Ports.js";
import type { TokenRevocationCachePort } from "../../../shared/auth/TokenRevocationCachePort.js";
import { AuthError, InternalAuthError } from "../domain/AuthErrors.js";

/**
 * Logout use case
 * Revokes the current access token (by jti) and the session's refresh tokens.
 */

export interface LogoutCommand {
    jti: string;
    userId: string;
    /** The session's current refresh token, so its rotation family can be revoked. */
    refreshToken?: string;
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
        private readonly refreshTokenRepo: IRefreshTokenRepository,
        private readonly tokenService: ITokenService,
        /** Access-token lifetime (ms) — the blacklist row only needs to outlive the token itself. */
        private readonly accessTtlMs: number,
        private readonly tokenRevocationCache?: TokenRevocationCachePort,
    ) {}

    async execute(command: LogoutCommand): Promise<LogoutResponse> {
        try {
            // Blacklist the access token only until its own `exp`. Because access
            // tokens are short-lived, the row can be safely swept afterwards — the
            // token is already expired by then, so it cannot resurrect.
            const expiresAt = new Date(Date.now() + this.accessTtlMs);

            // Revoke the access token (DB write — source of truth)
            await this.tokenRevocationRepo.revoke(command.jti, command.userId, expiresAt);

            // Invalidate cache immediately so subsequent `verify()` doesn't
            // serve stale `valid` until TTL expires. Seed `revoked` sentinel
            // to also short-circuit DB lookup in the meantime.
            this.tokenRevocationCache?.set(command.jti, "revoked");

            // Revoke the refresh token's whole rotation family so the session
            // cannot keep minting new access tokens after logout.
            if (command.refreshToken) {
                const hash = this.tokenService.hashRefreshToken(command.refreshToken);
                const row = await this.refreshTokenRepo.findByHash(hash);
                if (row) {
                    await this.refreshTokenRepo.revokeFamily(row.familyId);
                } else {
                    await this.refreshTokenRepo.revokeByHash(hash);
                }
            }

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
