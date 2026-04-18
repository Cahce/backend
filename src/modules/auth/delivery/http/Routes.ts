import type { FastifyInstance } from "fastify";
import { LoginUseCase } from "../../application/LoginUseCase.js";
import { GetCurrentUserUseCase } from "../../application/GetCurrentUserUseCase.js";
import { LogoutUseCase } from "../../application/LogoutUseCase.js";
import { ChangePasswordUseCase } from "../../application/ChangePasswordUseCase.js";
import { UserRepoPrisma } from "../../infra/UserRepoPrisma.js";
import { PasswordHasherBcrypt } from "../../infra/PasswordHasherBcrypt.js";
import { JwtTokenServiceFastify } from "../../infra/JwtTokenServiceFastify.js";
import { TokenRevocationRepoPrisma } from "../../infra/TokenRevocationRepoPrisma.js";
import {
    LoginRequestSchema,
    ChangePasswordRequestSchema,
    type LoginRequestDto,
    type ChangePasswordRequestDto,
} from "./Dto.js";

/**
 * JSON Schema definitions for Swagger/OpenAPI
 * Note: These are manually maintained but validated at runtime by Zod schemas in Dto.ts
 */
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
                description: "JWT access token",
                examples: ["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."],
            },
            user: {
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
                },
            },
        },
    },
    currentUserResponse: {
        type: "object",
        properties: {
            user: {
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
                },
            },
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


/**
 * Auth module HTTP routes
 */
export async function authRoutes(app: FastifyInstance) {
    // Wire dependencies
    const userRepo = new UserRepoPrisma(app.prisma);
    const passwordHasher = new PasswordHasherBcrypt();
    const tokenService = new JwtTokenServiceFastify(app);
    const tokenRevocationRepo = new TokenRevocationRepoPrisma(app.prisma);

    const loginUseCase = new LoginUseCase(userRepo, passwordHasher, tokenService);
    const getCurrentUserUseCase = new GetCurrentUserUseCase(userRepo);
    const logoutUseCase = new LogoutUseCase(tokenRevocationRepo);
    const changePasswordUseCase = new ChangePasswordUseCase(userRepo, passwordHasher);

    // POST /api/v1/auth/login
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
            // Validate request body
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

            // Execute use case
            const result = await loginUseCase.execute(parseResult.data);

            // Map result to HTTP response
            if (result.success) {
                return reply.code(200).send({
                    accessToken: result.accessToken,
                    user: result.user,
                });
            }

            // Map error codes to HTTP status codes
            const statusCode = getStatusCodeForError(result.error.code);
            return reply.code(statusCode).send({
                error: result.error,
            });
        },
    );

    // GET /api/v1/auth/me
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

            // Execute use case
            const result = await getCurrentUserUseCase.execute({ userId });

            // Map result to HTTP response
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

    // POST /api/v1/auth/logout
    app.post(
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

            // Execute use case
            const result = await logoutUseCase.execute({ jti, userId });

            // Map result to HTTP response
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

    // POST /api/v1/auth/change-password
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

            // Validate request body
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

            // Execute use case
            const result = await changePasswordUseCase.execute({
                userId,
                ...parseResult.data,
            });

            // Map result to HTTP response
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
}

/**
 * Maps error codes to HTTP status codes
 */
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
            return 401;
        case "ACCOUNT_INACTIVE":
            return 403;
        case "INTERNAL_ERROR":
        default:
            return 500;
    }
}
