import type { IPasswordHasher, IUserRepository } from "../domain/Ports.js";
import {
    AuthError,
    InternalAuthError,
    NewPasswordSameAsOldError,
    OldPasswordIncorrectError,
    PasswordsDoNotMatchError,
    UnauthorizedError,
} from "../domain/AuthErrors.js";


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
            const user = await this.userRepo.findById(command.userId);
            if (!user) {
                throw new UnauthorizedError();
            }

            if (!user.passwordHash) {
                throw new InternalAuthError("Tài khoản SSO không thể đổi mật khẩu");
            }

            if (command.newPassword !== command.confirmNewPassword) {
                throw new PasswordsDoNotMatchError();
            }

            const isOldPasswordValid = await this.passwordHasher.verify(
                command.oldPassword,
                user.passwordHash,
            );
            if (!isOldPasswordValid) {
                throw new OldPasswordIncorrectError();
            }

            const isNewPasswordSameAsOld = await this.passwordHasher.verify(
                command.newPassword,
                user.passwordHash,
            );
            if (isNewPasswordSameAsOld) {
                throw new NewPasswordSameAsOldError();
            }

            const newPasswordHash = await this.passwordHasher.hash(command.newPassword);

            await this.userRepo.updatePassword(user.id, newPasswordHash);

            return {
                success: true,
                message: "Đổi mật khẩu thành công",
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
