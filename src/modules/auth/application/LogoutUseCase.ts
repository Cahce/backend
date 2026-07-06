import type {
    ITokenRevocationRepository,
    IRefreshTokenRepository,
    ITokenService,
} from "../domain/Ports.js";
import type { TokenRevocationCachePort } from "../../../shared/auth/TokenRevocationCachePort.js";
import { AuthError, InternalAuthError } from "../domain/AuthErrors.js";


const NON_EXPIRING_TOKEN_REVOCATION_MS = 10 * 365 * 24 * 60 * 60 * 1000;

export interface LogoutCommand {
    jti: string;
    userId: string;
    tokenExpSeconds?: number;
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
            const expiresAt = command.tokenExpSeconds
                ? new Date(command.tokenExpSeconds * 1000)
                : new Date(Date.now() + NON_EXPIRING_TOKEN_REVOCATION_MS);

            await this.tokenRevocationRepo.revoke(command.jti, command.userId, expiresAt);

            this.tokenRevocationCache?.set(command.jti, "revoked");

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
            if (error instanceof AuthError) {
                return {
                    success: false,
                    error: {
                        code: error.code,
                        message: error.message,
                    },
                };
            }

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
