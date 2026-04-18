import type { IPasswordHasher, IUserRepository } from "../domain/Ports.js";
import {
    AuthError,
    InternalAuthError,
    NewPasswordSameAsOldError,
    OldPasswordIncorrectError,
    PasswordsDoNotMatchError,
    UnauthorizedError,
} from "../domain/AuthErrors.js";

/**
 * Change password use case
 * Allows authenticated users to change their password
 */

export interface ChangePasswordCommand {
    userId: string;
    oldPassword: string;
    newPassword: string;
    confirmNewPassword: string;
}

export interface ChangePasswordResult {
    success: true;
    message: string;
}

export interface ChangePasswordFailure {
    success: false;
    error: {
        code: string;
        message: string;
    };
}

export type ChangePasswordResponse = ChangePasswordResult | ChangePasswordFailure;

export class ChangePasswordUseCase {
    constructor(
        private readonly userRepo: IUserRepository,
        private readonly passwordHasher: IPasswordHasher,
    ) {}

    async execute(command: ChangePasswordCommand): Promise<ChangePasswordResponse> {
        try {
            // 1. Find user
            const user = await this.userRepo.findById(command.userId);
            if (!user) {
                throw new UnauthorizedError();
            }

            // 2. Check if user has a password (not SSO-only account)
            if (!user.passwordHash) {
                throw new InternalAuthError("Tài khoản SSO không thể đổi mật khẩu");
            }

            // 3. Verify old password
            const isOldPasswordValid = await this.passwordHasher.verify(
                command.oldPassword,
                user.passwordHash,
            );
            if (!isOldPasswordValid) {
                throw new OldPasswordIncorrectError();
            }

            // 4. Check if new password is different from old password
            const isNewPasswordSameAsOld = await this.passwordHasher.verify(
                command.newPassword,
                user.passwordHash,
            );
            if (isNewPasswordSameAsOld) {
                throw new NewPasswordSameAsOldError();
            }

            // 5. Check if new password matches confirmation
            if (command.newPassword !== command.confirmNewPassword) {
                throw new PasswordsDoNotMatchError();
            }

            // 6. Hash new password
            const newPasswordHash = await this.passwordHasher.hash(command.newPassword);

            // 7. Update password in database
            await this.userRepo.updatePassword(user.id, newPasswordHash);

            return {
                success: true,
                message: "Đổi mật khẩu thành công",
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
            console.error("Change password error:", error);
            const internalError = new InternalAuthError("Đổi mật khẩu thất bại");
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
