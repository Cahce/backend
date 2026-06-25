import type {
    ITokenRevocationRepository,
    IRefreshTokenRepository,
    ITokenService,
} from "../domain/Ports.js";
import type { TokenRevocationCachePort } from "../../../shared/auth/TokenRevocationCachePort.js";
import { AuthError, InternalAuthError } from "../domain/AuthErrors.js";

/**
 * Logout use case
 * Revokes the current JWT token
 */

/**
 * Fallback revocation lifetime for a token with no `exp` claim. Access tokens
 * are now signed with `expiresIn` (so `exp` is normally present and used), but
 * any legacy non-expiring token still in a browser must keep its revocation row
 * long enough that the sweeper never re-enables a logged-out token. ~10 years.
 */
const NON_EXPIRING_TOKEN_REVOCATION_MS = 10 * 365 * 24 * 60 * 60 * 1000;

export interface LogoutCommand {
    jti: string;
    userId: string;
    /** The access token's `exp` claim (seconds since epoch), if it has one. */
    tokenExpSeconds?: number;
    /** The rotating refresh token, if the client supplied it (to revoke its family). */
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
        private readonly tokenRevocationCache?: TokenRevocationCachePort,
    ) {}

    async execute(command: LogoutCommand): Promise<LogoutResponse> {
        try {
            // The revocation row must outlive the token it blocks. If the token
            // carries an `exp` claim, expire the row exactly then (self-cleaning).
            // Otherwise fall back to a long horizon — a hardcoded "+1 day" would
            // let the sweeper drop the row and revive a logged-out token.
            const expiresAt = command.tokenExpSeconds
                ? new Date(command.tokenExpSeconds * 1000)
                : new Date(Date.now() + NON_EXPIRING_TOKEN_REVOCATION_MS);

            // Revoke the token (DB write — source of truth)
            await this.tokenRevocationRepo.revoke(command.jti, command.userId, expiresAt);

            // Invalidate cache immediately so subsequent `verify()` doesn't
            // serve stale `valid` until TTL expires. Seed `revoked` sentinel
            // to also short-circuit DB lookup in the meantime.
            this.tokenRevocationCache?.set(command.jti, "revoked");

            // Also revoke the rotating refresh token (the whole family) if the
            // client supplied it, so the session cannot be silently refreshed
            // after logout. Best-effort: a failure here must NOT fail logout (the
            // refresh token still expires at its TTL).
            if (command.refreshToken) {
                try {
                    const row = await this.refreshTokenRepo.findByHash(
                        this.tokenService.hashRefreshToken(command.refreshToken),
                    );
                    if (row) {
                        await this.refreshTokenRepo.revokeFamily(row.familyId);
                    }
                } catch (err) {
                    console.error("Logout: refresh-token revoke failed (non-fatal):", err);
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
