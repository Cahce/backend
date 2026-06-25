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

export class UserNotFoundError extends AuthError {
    constructor() {
        super("Không tìm thấy người dùng", "USER_NOT_FOUND");
        this.name = "UserNotFoundError";
    }
}

/**
 * Auth error constants for use in use cases
 */
export const AuthErrors = {
    INVALID_EMAIL_FORMAT: {
        code: 'INVALID_EMAIL_FORMAT',
        message: 'Định dạng email không hợp lệ',
    },
    UNSUPPORTED_EMAIL_DOMAIN: {
        code: 'UNSUPPORTED_EMAIL_DOMAIN',
        message: 'Tên miền email không được hỗ trợ. Vui lòng sử dụng @tlu.edu.vn hoặc @e.tlu.edu.vn',
    },
    INVALID_CREDENTIALS: {
        code: 'INVALID_CREDENTIALS',
        message: 'Email hoặc mật khẩu không đúng',
    },
    ACCOUNT_INACTIVE: {
        code: 'ACCOUNT_INACTIVE',
        message: 'Tài khoản đã bị vô hiệu hóa',
    },
    UNAUTHORIZED: {
        code: 'UNAUTHORIZED',
        message: 'Chưa xác thực',
    },
    USER_NOT_FOUND: {
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy người dùng',
    },
    OLD_PASSWORD_INCORRECT: {
        code: 'OLD_PASSWORD_INCORRECT',
        message: 'Mật khẩu cũ không đúng',
    },
    PASSWORDS_DO_NOT_MATCH: {
        code: 'PASSWORDS_DO_NOT_MATCH',
        message: 'Mật khẩu xác nhận không khớp',
    },
    NEW_PASSWORD_SAME_AS_OLD: {
        code: 'NEW_PASSWORD_SAME_AS_OLD',
        message: 'Mật khẩu mới phải khác mật khẩu cũ',
    },
    // Token lifecycle (access expiry + rotating refresh). All map to HTTP 401.
    TOKEN_EXPIRED: {
        code: 'TOKEN_EXPIRED',
        message: 'Phiên đăng nhập đã hết hạn',
    },
    REFRESH_TOKEN_INVALID: {
        code: 'REFRESH_TOKEN_INVALID',
        message: 'Refresh token không hợp lệ',
    },
    REFRESH_TOKEN_EXPIRED: {
        code: 'REFRESH_TOKEN_EXPIRED',
        message: 'Refresh token đã hết hạn, vui lòng đăng nhập lại',
    },
    TOKEN_REUSE_DETECTED: {
        code: 'TOKEN_REUSE_DETECTED',
        message: 'Phát hiện tái sử dụng refresh token, phiên đã bị thu hồi',
    },
} as const;
