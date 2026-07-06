import { randomUUID } from "node:crypto";
import type {
    IPasswordHasher,
    IRefreshTokenRepository,
    ITokenService,
    IUserRepository,
} from "../domain/Ports.js";
import {
    AccountInactiveError,
    AuthError,
    InternalAuthError,
    InvalidCredentialsError,
} from "../domain/AuthErrors.js";
import { EmailPolicy } from "../domain/EmailPolicy.js";
import { getPermissionsForRole } from "../../../shared/auth/Permissions.js";
import type { LoginCommand, LoginResponse } from "./Types.js";

export class LoginUseCase {
    constructor(
        private readonly userRepo: IUserRepository,
        private readonly passwordHasher: IPasswordHasher,
        private readonly tokenService: ITokenService,
        private readonly refreshTokenRepo: IRefreshTokenRepository,
    ) {}

    async execute(command: LoginCommand): Promise<LoginResponse> {
        try {
            const normalizedEmail = EmailPolicy.normalize(command.email);
            EmailPolicy.validate(normalizedEmail);

            const user = await this.userRepo.findByEmail(normalizedEmail);
            if (!user) {
                throw new InvalidCredentialsError();
            }

            if (!user.isActive) {
                throw new AccountInactiveError();
            }

            const isPasswordValid = await this.passwordHasher.verify(
                command.password,
                user.passwordHash,
            );

            if (!isPasswordValid) {
                throw new InvalidCredentialsError();
            }

            const access = await this.tokenService.generateAccessToken({
                userId: user.id,
                email: user.email,
                role: user.role,
            });
            const refresh = this.tokenService.generateRefreshToken();
            await this.refreshTokenRepo.persist({
                tokenHash: this.tokenService.hashRefreshToken(refresh.token),
                userId: user.id,
                familyId: randomUUID(),
                expiresAt: refresh.expiresAt,
            });

            return {
                success: true,
                accessToken: access.token,
                refreshToken: refresh.token,
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
                return {
                    success: false,
                    error: {
                        code: error.code,
                        message: error.message,
                    },
                };
            }

            console.error("Login use case error:", error);
            const internalError = new InternalAuthError();
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
