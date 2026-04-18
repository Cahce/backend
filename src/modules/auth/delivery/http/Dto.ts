import { z } from "zod";

/**
 * Request/Response DTOs for auth endpoints
 */

// Login
export const LoginRequestSchema = z.object({
    email: z
        .string()
        .min(1, "Email là bắt buộc")
        .email("Định dạng email không hợp lệ")
        .describe("Email đăng nhập (phải sử dụng @tlu.edu.vn hoặc @e.tlu.edu.vn)"),
    password: z
        .string()
        .min(1, "Mật khẩu là bắt buộc")
        .describe("Mật khẩu"),
});

export type LoginRequestDto = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z.object({
    accessToken: z.string().describe("JWT access token"),
    user: z.object({
        id: z.string(),
        email: z.string(),
        role: z.enum(["admin", "student", "teacher"]),
    }),
});

export type LoginResponseDto = z.infer<typeof LoginResponseSchema>;

// Get Current User
export const GetCurrentUserResponseSchema = z.object({
    user: z.object({
        id: z.string(),
        email: z.string(),
        role: z.enum(["admin", "student", "teacher"]),
    }),
});

export type GetCurrentUserResponseDto = z.infer<typeof GetCurrentUserResponseSchema>;

// Logout
export const LogoutResponseSchema = z.object({
    message: z.string().describe("Thông báo kết quả"),
});

export type LogoutResponseDto = z.infer<typeof LogoutResponseSchema>;

// Change Password
export const ChangePasswordRequestSchema = z.object({
    oldPassword: z
        .string()
        .min(1, "Mật khẩu cũ là bắt buộc")
        .describe("Mật khẩu cũ"),
    newPassword: z
        .string()
        .min(1, "Mật khẩu mới là bắt buộc")
        .describe("Mật khẩu mới"),
    confirmNewPassword: z
        .string()
        .min(1, "Xác nhận mật khẩu là bắt buộc")
        .describe("Xác nhận mật khẩu mới"),
});

export type ChangePasswordRequestDto = z.infer<typeof ChangePasswordRequestSchema>;

export const ChangePasswordResponseSchema = z.object({
    message: z.string().describe("Thông báo kết quả"),
});

export type ChangePasswordResponseDto = z.infer<typeof ChangePasswordResponseSchema>;

// Error Response
export const ErrorResponseSchema = z.object({
    error: z.object({
        code: z.string().describe("Mã lỗi"),
        message: z.string().describe("Thông báo lỗi"),
    }),
});

export type ErrorResponseDto = z.infer<typeof ErrorResponseSchema>;
