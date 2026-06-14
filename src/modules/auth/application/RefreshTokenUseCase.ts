import type {
    IRefreshTokenRepository,
    ITokenService,
    IUserRepository,
} from "../domain/Ports.js";
import { AuthErrors } from "../domain/AuthErrors.js";
import { getPermissionsForRole } from "../../../shared/auth/Permissions.js";
import type { RefreshCommand, RefreshResponse } from "./Types.js";

/**
 * Refresh use case — exchanges a valid refresh token for a new token pair.
 *
 * Rotation: each successful refresh issues a NEW refresh token (same family) and
 * revokes the presented one. Presenting an already-revoked token is treated as
 * reuse/theft and burns the whole family.
 */
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
                return { success: false, error: AuthErrors.REFRESH_TOKEN_INVALID };
            }

            // Reuse of an already-rotated/revoked token → theft response.
            if (row.revokedAt) {
                await this.refreshTokenRepo.revokeFamily(row.familyId);
                return { success: false, error: AuthErrors.TOKEN_REUSE_DETECTED };
            }

            if (row.expiresAt.getTime() < Date.now()) {
                return { success: false, error: AuthErrors.REFRESH_TOKEN_EXPIRED };
            }

            const user = await this.userRepo.findById(row.userId);
            if (!user || !user.isActive) {
                // Account gone/disabled: burn the family so the token can't keep refreshing.
                await this.refreshTokenRepo.revokeFamily(row.familyId);
                return {
                    success: false,
                    error: user ? AuthErrors.ACCOUNT_INACTIVE : AuthErrors.REFRESH_TOKEN_INVALID,
                };
            }

            // Issue a new access token + rotate the refresh token (same family).
            const access = await this.tokenService.generateAccessToken({
                userId: user.id,
                email: user.email,
                role: user.role,
            });
            const newRefresh = this.tokenService.generateRefreshToken();
            await this.refreshTokenRepo.rotate(row.id, {
                tokenHash: this.tokenService.hashRefreshToken(newRefresh.token),
                familyId: row.familyId,
                expiresAt: newRefresh.expiresAt,
                userId: user.id,
            });

            return {
                success: true,
                accessToken: access.token,
                refreshToken: newRefresh.token,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    permissions: getPermissionsForRole(user.role),
                    mustChangePassword: user.mustChangePassword,
                },
            };
        } catch (error) {
            console.error("Refresh token use case error:", error);
            return {
                success: false,
                error: { code: "INTERNAL_ERROR", message: "Làm mới phiên đăng nhập thất bại" },
            };
        }
    }
}
