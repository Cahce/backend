import type { FastifyInstance } from "fastify";
import { LoginUseCase } from "../../application/LoginUseCase.js";
import { GetCurrentUserUseCase } from "../../application/GetCurrentUserUseCase.js";
import { GetUserByEmailUseCase } from "../../application/GetUserByEmailUseCase.js";
import { LogoutUseCase } from "../../application/LogoutUseCase.js";
import { ChangePasswordUseCase } from "../../application/ChangePasswordUseCase.js";
import { UserRepoPrisma } from "../../infra/UserRepoPrisma.js";
import { UserProfileQueryRepoPrisma } from "../../infra/UserProfileQueryRepoPrisma.js";
import { PasswordHasherBcrypt } from "../../infra/PasswordHasherBcrypt.js";
import { JwtTokenServiceFastify } from "../../infra/JwtTokenServiceFastify.js";
import { TokenRevocationRepoPrisma } from "../../infra/TokenRevocationRepoPrisma.js";
import { RefreshTokenRepoPrisma } from "../../infra/RefreshTokenRepoPrisma.js";
import { RefreshTokenUseCase } from "../../application/RefreshTokenUseCase.js";
import { UpdateOwnProfileUseCase } from "../../application/UpdateOwnProfileUseCase.js";
import { UserProfileMutationRepoPrisma } from "../../infra/UserProfileMutationRepoPrisma.js";
import {
    LoginRequestSchema,
    ChangePasswordRequestSchema,
    GetUserByEmailParamsSchema,
    RefreshRequestSchema,
    UpdateOwnProfileRequestSchema,
    type LoginRequestDto,
    type ChangePasswordRequestDto,
    type GetUserByEmailParamsDto,
    type RefreshRequestDto,
    type UpdateOwnProfileRequestDto,
} from "./Dto.js";


const userResponseSchema = {
    type: "object",
    properties: {
        id: {
            type: "string",
            examples: ["cmnztabnn0000e8vmyzb8gqtn"],
        },
        email: {
            type: "string",
            examples: ["admin@tlu.edu.vn"],
        },
        role: {
            type: "string",
            enum: ["admin", "student", "teacher"],
            examples: ["admin"],
        },
        permissions: {
            type: "array",
            items: { type: "string" },
            description: "Danh sách quyền (RBAC) suy ra từ vai trò",
            examples: [["admin:access", "users:manage"]],
        },
        mustChangePassword: {
            type: "boolean",
            description: "Bắt buộc đổi mật khẩu trước khi sử dụng",
            examples: [false],
        },
    },
} as const;

const schemas = {
    loginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
            email: {
                type: "string",
                format: "email",
                description: "Email đăng nhập (phải sử dụng @tlu.edu.vn hoặc @e.tlu.edu.vn)",
                examples: ["2251172560@e.tlu.edu.vn"],
            },
            password: {
                type: "string",
                description: "Mật khẩu",
                examples: ["123456"],
            },
        },
    },
    loginResponse: {
        type: "object",
        properties: {
            accessToken: {
                type: "string",
                description: "JWT access token (ngắn hạn)",
                examples: ["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."],
            },
            refreshToken: {
                type: "string",
                description: "Refresh token (xoay vòng, đổi ở /auth/refresh)",
            },
            user: userResponseSchema,
        },
    },
    refreshRequest: {
        type: "object",
        required: ["refreshToken"],
        properties: {
            refreshToken: { type: "string", description: "Refresh token hiện tại" },
        },
    },
    refreshResponse: {
        type: "object",
        properties: {
            accessToken: { type: "string", description: "Access token mới (ngắn hạn)" },
            refreshToken: { type: "string", description: "Refresh token mới (token cũ bị thu hồi)" },
            user: userResponseSchema,
        },
    },
    currentUserResponse: {
        type: "object",
        properties: {
            user: userResponseSchema,
        },
    },
    changePasswordRequest: {
        type: "object",
        required: ["oldPassword", "newPassword", "confirmNewPassword"],
        properties: {
            oldPassword: {
                type: "string",
                description: "Mật khẩu cũ",
                examples: ["123456"],
            },
            newPassword: {
                type: "string",
                description: "Mật khẩu mới",
                examples: ["MatKhauMoi@123"],
            },
            confirmNewPassword: {
                type: "string",
                description: "Xác nhận mật khẩu mới",
                examples: ["MatKhauMoi@123"],
            },
        },
    },
    messageResponse: {
        type: "object",
        properties: {
            message: {
                type: "string",
                description: "Thông báo kết quả",
                examples: ["Thành công"],
            },
        },
    },
    userWithProfileResponse: {
        type: "object",
        properties: {
            id: { type: "string" },
            email: { type: "string" },
            role: { type: "string", enum: ["admin", "student", "teacher"] },
            isActive: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            studentProfile: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    studentCode: { type: "string" },
                    fullName: { type: "string" },
                    phone: { type: "string", nullable: true },
                    gender: { type: "string", enum: ["male", "female", "other"], nullable: true },
                    dateOfBirth: { type: "string", format: "date-time", nullable: true },
                    address: { type: "string", nullable: true },
                    class: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            name: { type: "string" },
                            code: { type: "string" },
                            major: {
                                type: "object",
                                properties: {
                                    id: { type: "string" },
                                    name: { type: "string" },
                                    code: { type: "string" },
                                    faculty: {
                                        type: "object",
                                        properties: {
                                            id: { type: "string" },
                                            name: { type: "string" },
                                            code: { type: "string" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            teacherProfile: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    teacherCode: { type: "string" },
                    fullName: { type: "string" },
                    phone: { type: "string", nullable: true },
                    gender: { type: "string", enum: ["male", "female", "other"], nullable: true },
                    dateOfBirth: { type: "string", format: "date-time", nullable: true },
                    address: { type: "string", nullable: true },
                    academicRank: { type: "string" },
                    academicDegree: { type: "string" },
                    department: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            name: { type: "string" },
                            code: { type: "string" },
                            faculty: {
                                type: "object",
                                properties: {
                                    id: { type: "string" },
                                    name: { type: "string" },
                                    code: { type: "string" },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
    updateOwnProfileRequest: {
        type: "object",
        properties: {
            gender: { type: "string", enum: ["male", "female", "other"], nullable: true },
            dateOfBirth: {
                type: "string",
                nullable: true,
                description: "Ngày sinh (ISO, ví dụ 2002-01-15)",
            },
            phone: { type: "string", nullable: true },
            address: { type: "string", nullable: true },
        },
    },
    ownProfileResponse: {
        type: "object",
        properties: {
            profile: {
                type: "object",
                properties: {
                    gender: { type: "string", enum: ["male", "female", "other"], nullable: true },
                    dateOfBirth: { type: "string", format: "date-time", nullable: true },
                    phone: { type: "string", nullable: true },
                    address: { type: "string", nullable: true },
                },
            },
        },
    },
    errorResponse: {
        type: "object",
        properties: {
            error: {
                type: "object",
                properties: {
                    code: {
                        type: "string",
                        description: "Mã lỗi",
                        examples: ["INVALID_CREDENTIALS"],
                    },
                    message: {
                        type: "string",
                        description: "Thông báo lỗi",
                        examples: ["Email hoặc mật khẩu không đúng"],
                    },
                },
            },
        },
    },
} as const;

export { schemas as authResponseSchemas };

export async function authRoutes(app: FastifyInstance) {
    const userRepo = new UserRepoPrisma(app.prisma);
    const userProfileQuery = new UserProfileQueryRepoPrisma(app.prisma);
    const passwordHasher = new PasswordHasherBcrypt();
    const tokenService = new JwtTokenServiceFastify(app);
    const tokenRevocationRepo = new TokenRevocationRepoPrisma(app.prisma);

    const refreshTokenRepo = new RefreshTokenRepoPrisma(app.prisma);

    const loginUseCase = new LoginUseCase(userRepo, passwordHasher, tokenService, refreshTokenRepo);
    const getCurrentUserUseCase = new GetCurrentUserUseCase(userRepo);
    const getUserByEmailUseCase = new GetUserByEmailUseCase(userProfileQuery);
    const refreshTokenUseCase = new RefreshTokenUseCase(userRepo, tokenService, refreshTokenRepo);
    const logoutUseCase = new LogoutUseCase(
        tokenRevocationRepo,
        refreshTokenRepo,
        tokenService,
        app.tokenRevocationCache,
    );
    const changePasswordUseCase = new ChangePasswordUseCase(userRepo, passwordHasher);
    const userProfileMutation = new UserProfileMutationRepoPrisma(app.prisma);
    const updateOwnProfileUseCase = new UpdateOwnProfileUseCase(userProfileMutation);

    app.post<{ Body: LoginRequestDto }>(
        "/login",
        {
            schema: {
                description: "Đăng nhập bằng email và mật khẩu",
                tags: ["auth"],
                body: schemas.loginRequest,
                response: {
                    200: schemas.loginResponse,
                    400: schemas.errorResponse,
                    401: schemas.errorResponse,
                    403: schemas.errorResponse,
                    500: schemas.errorResponse,
                },
            },
        },
        async (request, reply) => {
            const parseResult = LoginRequestSchema.safeParse(request.body);

            if (!parseResult.success) {
                const firstError = parseResult.error.issues[0];
                return reply.code(400).send({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: firstError.message,
                    },
                });
            }

            const result = await loginUseCase.execute(parseResult.data);

            if (result.success) {
                return reply.code(200).send({
                    accessToken: result.accessToken,
                    refreshToken: result.refreshToken,
                    user: result.user,
                });
            }

            const statusCode = getStatusCodeForError(result.error.code);
            return reply.code(statusCode).send({
                error: result.error,
            });
        },
    );

    app.get(
        "/me",
        {
            preHandler: app.auth.verify,
            schema: {
                description: "Lấy thông tin người dùng hiện tại",
                tags: ["auth"],
                security: [{ bearerAuth: [] }],
                response: {
                    200: schemas.currentUserResponse,
                    401: schemas.errorResponse,
                    500: schemas.errorResponse,
                },
            },
        },
        async (request, reply) => {
            const userId = request.user.sub;

            const result = await getCurrentUserUseCase.execute({ userId });

            if (result.success) {
                return reply.code(200).send({
                    user: result.user,
                });
            }

            const statusCode = getStatusCodeForError(result.error.code) as 200 | 401 | 500;
            return reply.code(statusCode).send({
                error: result.error,
            });
        },
    );

    app.get<{ Params: GetUserByEmailParamsDto }>(
        "/user/:email",
        {
            preHandler: app.auth.verify,
            schema: {
                description: "Lấy thông tin người dùng theo email (bao gồm profile sinh viên/giảng viên)",
                tags: ["auth"],
                security: [{ bearerAuth: [] }],
                params: {
                    type: "object",
                    required: ["email"],
                    properties: {
                        email: {
                            type: "string",
                            format: "email",
                            description: "Email của người dùng cần tra cứu",
                        },
                    },
                },
                response: {
                    200: schemas.userWithProfileResponse,
                    401: schemas.errorResponse,
                    403: schemas.errorResponse,
                    404: schemas.errorResponse,
                    500: schemas.errorResponse,
                },
            },
        },
        async (request, reply) => {
            const requesterId = request.user.sub;
            const requesterRole = request.user.role;

            const parseResult = GetUserByEmailParamsSchema.safeParse(request.params);

            if (!parseResult.success) {
                const firstError = parseResult.error.issues[0];
                return reply.code(400).send({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: firstError.message,
                    },
                });
            }

            const result = await getUserByEmailUseCase.execute({
                email: parseResult.data.email,
                requesterId,
                requesterRole,
            });

            if (result.success) {
                return reply.code(200).send({
                    ...result.data,
                    createdAt: result.data.createdAt.toISOString(),
                    updatedAt: result.data.updatedAt.toISOString(),
                });
            }

            const statusCode = getStatusCodeForError(result.error.code);
            return reply.code(statusCode).send({
                error: result.error,
            });
        },
    );

    app.post<{ Body: RefreshRequestDto }>(
        "/refresh",
        {
            schema: {
                description: "Làm mới phiên: đổi refresh token lấy cặp token mới (xoay vòng)",
                tags: ["auth"],
                body: schemas.refreshRequest,
                response: {
                    200: schemas.refreshResponse,
                    400: schemas.errorResponse,
                    401: schemas.errorResponse,
                    500: schemas.errorResponse,
                },
            },
        },
        async (request, reply) => {
            const parseResult = RefreshRequestSchema.safeParse(request.body);
            if (!parseResult.success) {
                return reply.code(400).send({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: parseResult.error.issues[0].message,
                    },
                });
            }

            const result = await refreshTokenUseCase.execute(parseResult.data);

            if (result.success) {
                return reply.code(200).send({
                    accessToken: result.accessToken,
                    refreshToken: result.refreshToken,
                    user: result.user,
                });
            }

            const statusCode = getStatusCodeForError(result.error.code);
            return reply.code(statusCode).send({ error: result.error });
        },
    );

    app.post<{ Body: { refreshToken?: string } }>(
        "/logout",
        {
            preHandler: app.auth.verify,
            schema: {
                description: "Đăng xuất và vô hiệu hóa token hiện tại",
                tags: ["auth"],
                security: [{ bearerAuth: [] }],
                response: {
                    200: schemas.messageResponse,
                    401: schemas.errorResponse,
                    500: schemas.errorResponse,
                },
            },
        },
        async (request, reply) => {
            const jti = request.user.jti;
            const userId = request.user.sub;
            const tokenExpSeconds = (request.user as { exp?: number }).exp;
            const refreshToken = request.body?.refreshToken;

            const result = await logoutUseCase.execute({ jti, userId, tokenExpSeconds, refreshToken });

            if (result.success) {
                return reply.code(200).send({
                    message: result.message,
                });
            }

            const statusCode = getStatusCodeForError(result.error.code) as 200 | 401 | 500;
            return reply.code(statusCode).send({
                error: result.error,
            });
        },
    );

    app.post<{ Body: ChangePasswordRequestDto }>(
        "/change-password",
        {
            preHandler: app.auth.verify,
            schema: {
                description: "Đổi mật khẩu",
                tags: ["auth"],
                security: [{ bearerAuth: [] }],
                body: schemas.changePasswordRequest,
                response: {
                    200: schemas.messageResponse,
                    400: schemas.errorResponse,
                    401: schemas.errorResponse,
                    500: schemas.errorResponse,
                },
            },
        },
        async (request, reply) => {
            const userId = request.user.sub;

            const parseResult = ChangePasswordRequestSchema.safeParse(request.body);

            if (!parseResult.success) {
                const firstError = parseResult.error.issues[0];
                return reply.code(400).send({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: firstError.message,
                    },
                });
            }

            const result = await changePasswordUseCase.execute({
                userId,
                ...parseResult.data,
            });

            if (result.success) {
                return reply.code(200).send({
                    message: result.message,
                });
            }

            const statusCode = getStatusCodeForError(result.error.code) as
                | 200
                | 400
                | 401
                | 500;
            return reply.code(statusCode).send({
                error: result.error,
            });
        },
    );

    app.put<{ Body: UpdateOwnProfileRequestDto }>(
        "/me/profile",
        {
            preHandler: app.auth.verify,
            schema: {
                description:
                    "Người dùng tự cập nhật thông tin cá nhân (giới tính, ngày sinh, số điện thoại, địa chỉ)",
                tags: ["auth"],
                security: [{ bearerAuth: [] }],
                body: schemas.updateOwnProfileRequest,
                response: {
                    200: schemas.ownProfileResponse,
                    400: schemas.errorResponse,
                    401: schemas.errorResponse,
                    403: schemas.errorResponse,
                    404: schemas.errorResponse,
                    500: schemas.errorResponse,
                },
            },
        },
        async (request, reply) => {
            const accountId = request.user.sub;
            const role = request.user.role;

            const parseResult = UpdateOwnProfileRequestSchema.safeParse(request.body);
            if (!parseResult.success) {
                return reply.code(400).send({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: parseResult.error.issues[0].message,
                    },
                });
            }

            const result = await updateOwnProfileUseCase.execute({
                accountId,
                role,
                data: parseResult.data,
            });

            if (result.success) {
                return reply.code(200).send({
                    profile: {
                        gender: result.data.gender,
                        dateOfBirth: result.data.dateOfBirth
                            ? result.data.dateOfBirth.toISOString()
                            : null,
                        phone: result.data.phone,
                        address: result.data.address,
                    },
                });
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );
}

function getStatusCodeForError(errorCode: string): number {
    switch (errorCode) {
        case "VALIDATION_ERROR":
        case "INVALID_EMAIL_FORMAT":
        case "UNSUPPORTED_EMAIL_DOMAIN":
        case "OLD_PASSWORD_INCORRECT":
        case "PASSWORDS_DO_NOT_MATCH":
        case "NEW_PASSWORD_SAME_AS_OLD":
            return 400;
        case "INVALID_CREDENTIALS":
        case "UNAUTHORIZED":
        case "TOKEN_EXPIRED":
        case "REFRESH_TOKEN_INVALID":
        case "REFRESH_TOKEN_EXPIRED":
        case "TOKEN_REUSE_DETECTED":
            return 401;
        case "ACCOUNT_INACTIVE":
        case "PROFILE_NOT_EDITABLE":
            return 403;
        case "USER_NOT_FOUND":
        case "PROFILE_NOT_LINKED":
            return 404;
        case "INTERNAL_ERROR":
        default:
            return 500;
    }
}
