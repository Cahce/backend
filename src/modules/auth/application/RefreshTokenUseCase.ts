
import { AuthError, AuthErrors } from "../domain/AuthErrors.js";
import type {
    IRefreshTokenRepository,
    ITokenService,
    IUserRepository,
} from "../domain/Ports.js";
import { getPermissionsForRole } from "../../../shared/auth/Permissions.js";
import type { AuthUserView } from "./Types.js";

export interface RefreshCommand {
    refreshToken: string;
}

export interface RefreshSuccess {
    success: true;
    accessToken: string;
    refreshToken: string;
    user: AuthUserView;
}

export interface RefreshFailure {
    success: false;
    error: { code: string; message: string };
}

export type RefreshResponse = RefreshSuccess | RefreshFailure;

export class RefreshTokenUseCase {
    constructor(
        private readonly userRepo: IUserRepository,
        private readonly tokenService: ITokenService,
        private readonly refreshTokenRepo: IRefreshTokenRepository,
    ) {}

    async execute(command: RefreshCommand): Promise<RefreshResponse> {
        try {
            const tokenHash = this.tokenService.hashRefreshToken(command.refreshToken);
            const row = await this.refreshTokenRepo.findByHash(tokenHash);

            if (!row) {
                return this.fail(AuthErrors.REFRESH_TOKEN_INVALID);
            }

            if (row.revokedAt !== null) {
                await this.refreshTokenRepo.revokeFamily(row.familyId);
                return this.fail(AuthErrors.TOKEN_REUSE_DETECTED);
            }

            if (row.expiresAt.getTime() < Date.now()) {
                return this.fail(AuthErrors.REFRESH_TOKEN_EXPIRED);
            }

            const user = await this.userRepo.findById(row.userId);
            if (!user || !user.isActive) {
                await this.refreshTokenRepo.revokeFamily(row.familyId);
                return this.fail(AuthErrors.REFRESH_TOKEN_INVALID);
            }

            const access = await this.tokenService.generateAccessToken({
                userId: user.id,
                email: user.email,
                role: user.role,
            });
            const nextRefresh = this.tokenService.generateRefreshToken();
            await this.refreshTokenRepo.rotate(row.id, {
                tokenHash: this.tokenService.hashRefreshToken(nextRefresh.token),
                familyId: row.familyId,
                expiresAt: nextRefresh.expiresAt,
                userId: user.id,
            });

            return {
                success: true,
                accessToken: access.token,
                refreshToken: nextRefresh.token,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    permissions: getPermissionsForRole(user.role),
                    mustChangePassword: user.mustChangePassword,
                },
            };
        } catch (error) {
            if (error instanceof AuthError) {
                return this.fail({ code: error.code, message: error.message });
            }
            console.error("Refresh token use case error:", error);
            return {
                success: false,
                error: { code: "INTERNAL_ERROR", message: "Làm mới phiên thất bại" },
            };
        }
    }

    private fail(e: { code: string; message: string }): RefreshFailure {
        return { success: false, error: { code: e.code, message: e.message } };
    }
}
