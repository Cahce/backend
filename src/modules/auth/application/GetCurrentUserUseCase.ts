import type { IUserRepository } from "../domain/Ports.js";
import { AuthError, InternalAuthError, UnauthorizedError } from "../domain/AuthErrors.js";

/**
 * Get current user use case
 * Returns user information from JWT token payload
 */

export interface GetCurrentUserCommand {
    userId: string;
}

export interface GetCurrentUserResult {
    success: true;
    user: {
        id: string;
        email: string;
        role: "admin" | "student" | "teacher";
    };
}

export interface GetCurrentUserFailure {
    success: false;
    error: {
        code: string;
        message: string;
    };
}

export type GetCurrentUserResponse = GetCurrentUserResult | GetCurrentUserFailure;

export class GetCurrentUserUseCase {
    constructor(private readonly userRepo: IUserRepository) {}

    async execute(command: GetCurrentUserCommand): Promise<GetCurrentUserResponse> {
        try {
            // Find user by ID from token
            const user = await this.userRepo.findById(command.userId);
            if (!user) {
                throw new UnauthorizedError();
            }

            // Check if account is active
            if (!user.isActive) {
                throw new UnauthorizedError();
            }

            // Return user information
            return {
                success: true,
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
            console.error("Get current user error:", error);
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
