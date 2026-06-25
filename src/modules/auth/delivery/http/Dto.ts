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

const AuthUserSchema = z.object({
    id: z.string(),
    email: z.string(),
    role: z.enum(["admin", "student", "teacher"]),
    permissions: z.array(z.string()).describe("Danh sách quyền (RBAC) suy ra từ vai trò"),
    mustChangePassword: z.boolean().describe("Bắt buộc đổi mật khẩu trước khi sử dụng"),
});

export const LoginResponseSchema = z.object({
    accessToken: z.string().describe("JWT access token (ngắn hạn)"),
    refreshToken: z.string().describe("Refresh token (xoay vòng, đổi ở /auth/refresh)"),
    user: AuthUserSchema,
});

export type LoginResponseDto = z.infer<typeof LoginResponseSchema>;

// Refresh
export const RefreshRequestSchema = z.object({
    refreshToken: z.string().min(1, "refreshToken là bắt buộc").describe("Refresh token hiện tại"),
});

export type RefreshRequestDto = z.infer<typeof RefreshRequestSchema>;

export const RefreshResponseSchema = z.object({
    accessToken: z.string().describe("JWT access token mới"),
    refreshToken: z.string().describe("Refresh token mới (token cũ bị thu hồi)"),
    user: AuthUserSchema,
});

export type RefreshResponseDto = z.infer<typeof RefreshResponseSchema>;

// Get Current User
export const GetCurrentUserResponseSchema = z.object({
    user: z.object({
        id: z.string(),
        email: z.string(),
        role: z.enum(["admin", "student", "teacher"]),
        permissions: z.array(z.string()).describe("Danh sách quyền (RBAC) suy ra từ vai trò"),
        mustChangePassword: z.boolean().describe("Bắt buộc đổi mật khẩu trước khi sử dụng"),
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

// Get User By Email
export const GetUserByEmailParamsSchema = z.object({
    email: z
        .string()
        .email("Định dạng email không hợp lệ")
        .describe("Email của người dùng cần tra cứu"),
});

export type GetUserByEmailParamsDto = z.infer<typeof GetUserByEmailParamsSchema>;

export const UserWithProfileResponseSchema = z.object({
    id: z.string(),
    email: z.string(),
    role: z.enum(["admin", "student", "teacher"]),
    isActive: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
    studentProfile: z.object({
        id: z.string(),
        studentCode: z.string(),
        fullName: z.string(),
        phone: z.string().nullable(),
        gender: z.enum(["male", "female", "other"]).nullable(),
        dateOfBirth: z.string().nullable(),
        address: z.string().nullable(),
        class: z.object({
            id: z.string(),
            name: z.string(),
            code: z.string(),
            major: z.object({
                id: z.string(),
                name: z.string(),
                code: z.string(),
                faculty: z.object({
                    id: z.string(),
                    name: z.string(),
                    code: z.string(),
                }),
            }),
        }),
    }).optional(),
    teacherProfile: z.object({
        id: z.string(),
        teacherCode: z.string(),
        fullName: z.string(),
        phone: z.string().nullable(),
        gender: z.enum(["male", "female", "other"]).nullable(),
        dateOfBirth: z.string().nullable(),
        address: z.string().nullable(),
        academicRank: z.string(),
        academicDegree: z.string(),
        department: z.object({
            id: z.string(),
            name: z.string(),
            code: z.string(),
            faculty: z.object({
                id: z.string(),
                name: z.string(),
                code: z.string(),
            }),
        }),
    }).optional(),
});

export type UserWithProfileResponseDto = z.infer<typeof UserWithProfileResponseSchema>;

// Update Own Profile (self-service personal info: gender/dateOfBirth/phone/address)
export const UpdateOwnProfileRequestSchema = z.object({
    gender: z.enum(["male", "female", "other"]).nullable().optional(),
    dateOfBirth: z.coerce.date().nullable().optional(),
    phone: z.string().trim().max(20, "Số điện thoại tối đa 20 ký tự").nullable().optional(),
    address: z.string().trim().max(255, "Địa chỉ tối đa 255 ký tự").nullable().optional(),
});

export type UpdateOwnProfileRequestDto = z.infer<typeof UpdateOwnProfileRequestSchema>;
