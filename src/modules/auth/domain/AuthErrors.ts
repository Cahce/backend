/**
 * Domain errors for authentication module
 * All messages are in Vietnamese as per requirements
 */

export class AuthError extends Error {
    constructor(
        message: string,
        public readonly code: string,
    ) {
        super(message);
        this.name = "AuthError";
    }
}

export class InvalidEmailFormatError extends AuthError {
    constructor() {
        super("Định dạng email không hợp lệ", "INVALID_EMAIL_FORMAT");
        this.name = "InvalidEmailFormatError";
    }
}

export class UnsupportedEmailDomainError extends AuthError {
    constructor() {
        super(
            "Tên miền email không được hỗ trợ. Vui lòng sử dụng @tlu.edu.vn hoặc @e.tlu.edu.vn",
            "UNSUPPORTED_EMAIL_DOMAIN",
        );
        this.name = "UnsupportedEmailDomainError";
    }
}

export class InvalidCredentialsError extends AuthError {
    constructor() {
        super("Email hoặc mật khẩu không đúng", "INVALID_CREDENTIALS");
        this.name = "InvalidCredentialsError";
    }
}

export class AccountInactiveError extends AuthError {
    constructor() {
        super("Tài khoản đã bị vô hiệu hóa", "ACCOUNT_INACTIVE");
        this.name = "AccountInactiveError";
    }
}

export class InternalAuthError extends AuthError {
    constructor(message = "Xác thực thất bại") {
        super(message, "INTERNAL_ERROR");
        this.name = "InternalAuthError";
    }
}

export class UnauthorizedError extends AuthError {
    constructor() {
        super("Chưa xác thực", "UNAUTHORIZED");
        this.name = "UnauthorizedError";
    }
}

export class OldPasswordIncorrectError extends AuthError {
    constructor() {
        super("Mật khẩu cũ không đúng", "OLD_PASSWORD_INCORRECT");
        this.name = "OldPasswordIncorrectError";
    }
}

export class PasswordsDoNotMatchError extends AuthError {
    constructor() {
        super("Mật khẩu xác nhận không khớp", "PASSWORDS_DO_NOT_MATCH");
        this.name = "PasswordsDoNotMatchError";
    }
}

export class NewPasswordSameAsOldError extends AuthError {
    constructor() {
        super("Mật khẩu mới phải khác mật khẩu cũ", "NEW_PASSWORD_SAME_AS_OLD");
        this.name = "NewPasswordSameAsOldError";
    }
}
