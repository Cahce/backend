import type {
    IPasswordHasher,
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
import type { LoginCommand, LoginResponse } from "./Types.js";

/**
 * Login use case
 * Orchestrates the login flow following clean architecture principles
 */
export class LoginUseCase {
    constructor(
        private readonly userRepo: IUserRepository,
        private readonly passwordHasher: IPasswordHasher,
        private readonly tokenService: ITokenService,
    ) {}

    async execute(command: LoginCommand): Promise<LoginResponse> {
        try {
            // 1. Validate and normalize email
            const normalizedEmail = EmailPolicy.normalize(command.email);
            EmailPolicy.validate(normalizedEmail);

            // 2. Find user by email
            const user = await this.userRepo.findByEmail(normalizedEmail);
            if (!user) {
                throw new InvalidCredentialsError();
            }

            // 3. Check if account is active
            if (!user.isActive) {
                throw new AccountInactiveError();
            }

            // 4. Verify password
            const isPasswordValid = await this.passwordHasher.verify(
                command.password,
                user.passwordHash,
            );

            if (!isPasswordValid) {
                throw new InvalidCredentialsError();
            }

            // 5. Generate JWT token
            const accessToken = await this.tokenService.generate({
                userId: user.id,
                email: user.email,
                role: user.role,
            });

            // 6. Return success result
            return {
                success: true,
                accessToken,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                },
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
