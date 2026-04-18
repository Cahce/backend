import type { FastifyInstance } from "fastify";
import { CreateTeacherProfileUseCase } from "../../../application/TeacherManagement/CreateTeacherProfileUseCase.js";
import { ListTeacherProfilesUseCase } from "../../../application/TeacherManagement/ListTeacherProfilesUseCase.js";
import { GetTeacherProfileDetailsUseCase } from "../../../application/TeacherManagement/GetTeacherProfileDetailsUseCase.js";
import { UpdateTeacherProfileUseCase } from "../../../application/TeacherManagement/UpdateTeacherProfileUseCase.js";
import { DeleteTeacherProfileUseCase } from "../../../application/TeacherManagement/DeleteTeacherProfileUseCase.js";
import { LinkAccountToTeacherUseCase } from "../../../application/TeacherManagement/LinkAccountToTeacherUseCase.js";
import { UnlinkAccountFromTeacherUseCase } from "../../../application/TeacherManagement/UnlinkAccountFromTeacherUseCase.js";
import { TeacherProfileRepoPrisma } from "../../../infra/TeacherProfileRepoPrisma.js";
import { DepartmentRepoPrisma } from "../../../infra/DepartmentRepoPrisma.js";
import { AdminAccountRepoPrisma } from "../../../infra/AdminAccountRepoPrisma.js";
import {
    CreateTeacherRequestSchema,
    UpdateTeacherRequestSchema,
    ListTeachersQuerySchema,
    LinkAccountRequestSchema,
    type CreateTeacherRequestDto,
    type UpdateTeacherRequestDto,
    type ListTeachersQueryDto,
    type LinkAccountRequestDto,
    CreateTeacherBodyJsonSchema,
    UpdateTeacherBodyJsonSchema,
    ListTeachersQueryJsonSchema,
    LinkAccountBodyJsonSchema,
    TeacherResponseJsonSchema,
    ListTeachersResponseJsonSchema,
    ErrorResponseJsonSchema,
    MessageResponseJsonSchema,
} from "./Dto.js";

/**
 * Teacher Management module HTTP routes
 */
export async function teacherManagementRoutes(app: FastifyInstance) {
    const teacherRepo = new TeacherProfileRepoPrisma(app.prisma);
    const departmentRepo = new DepartmentRepoPrisma(app.prisma);
    const accountRepo = new AdminAccountRepoPrisma(app.prisma);

    const createTeacherUseCase = new CreateTeacherProfileUseCase(teacherRepo, departmentRepo);
    const listTeachersUseCase = new ListTeacherProfilesUseCase(teacherRepo);
    const getTeacherDetailsUseCase = new GetTeacherProfileDetailsUseCase(teacherRepo);
    const updateTeacherUseCase = new UpdateTeacherProfileUseCase(teacherRepo, departmentRepo);
    const deleteTeacherUseCase = new DeleteTeacherProfileUseCase(teacherRepo);
    const linkAccountUseCase = new LinkAccountToTeacherUseCase(teacherRepo, accountRepo);
    const unlinkAccountUseCase = new UnlinkAccountFromTeacherUseCase(teacherRepo);

    // POST /api/v1/admin/teachers - create teacher
    app.post<{ Body: CreateTeacherRequestDto }>(
        "/teachers",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Tạo hồ sơ giảng viên mới",
                tags: ["admin-teachers"],
                security: [{ bearerAuth: [] }],
                body: CreateTeacherBodyJsonSchema,
                response: {
                    201: {
                        description: "Tạo giảng viên thành công",
                        ...TeacherResponseJsonSchema,
                    },
                    400: {
                        description: "Dữ liệu đầu vào không hợp lệ",
                        ...ErrorResponseJsonSchema,
                    },
                    401: {
                        description: "Chưa đăng nhập hoặc token không hợp lệ",
                        ...ErrorResponseJsonSchema,
                    },
                    403: {
                        description: "Không có quyền truy cập (chỉ admin)",
                        ...ErrorResponseJsonSchema,
                    },
                    409: {
                        description: "Mã giảng viên đã tồn tại",
                        ...ErrorResponseJsonSchema,
                    },
                    500: {
                        description: "Lỗi hệ thống",
                        ...ErrorResponseJsonSchema,
                    },
                },
            },
        },
        async (request, reply) => {
            const parseResult = CreateTeacherRequestSchema.safeParse(request.body);

            if (!parseResult.success) {
                const firstError = parseResult.error.issues[0];
                return reply.code(400).send({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: firstError.message,
                    },
                });
            }

            const result = await createTeacherUseCase.execute(parseResult.data);

            if (result.success) {
                return reply.code(201).send(result.data);
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // GET /api/v1/admin/teachers - list teachers with pagination and filters
    app.get<{ Querystring: ListTeachersQueryDto }>(
        "/teachers",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Lấy danh sách giảng viên, sắp xếp theo cập nhật mới nhất",
                tags: ["admin-teachers"],
                security: [{ bearerAuth: [] }],
                querystring: ListTeachersQueryJsonSchema,
                response: {
                    200: {
                        description: "Lấy danh sách giảng viên thành công",
                        ...ListTeachersResponseJsonSchema,
                    },
                    400: {
                        description: "Query params không hợp lệ",
                        ...ErrorResponseJsonSchema,
                    },
                    401: {
                        description: "Chưa đăng nhập hoặc token không hợp lệ",
                        ...ErrorResponseJsonSchema,
                    },
                    403: {
                        description: "Không có quyền truy cập (chỉ admin)",
                        ...ErrorResponseJsonSchema,
                    },
                    500: {
                        description: "Lỗi hệ thống",
                        ...ErrorResponseJsonSchema,
                    },
                },
            },
        },
        async (request, reply) => {
            const parseResult = ListTeachersQuerySchema.safeParse(request.query);

            if (!parseResult.success) {
                const firstError = parseResult.error.issues[0];
                return reply.code(400).send({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: firstError.message,
                    },
                });
            }

            const result = await listTeachersUseCase.execute(parseResult.data);

            if (result.success) {
                return reply.code(200).send(result.data);
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // GET /api/v1/admin/teachers/:id - get teacher by id
    app.get<{ Params: { id: string } }>(
        "/teachers/:id",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Lấy chi tiết giảng viên theo ID",
                tags: ["admin-teachers"],
                security: [{ bearerAuth: [] }],
                params: {
                    type: "object",
                    required: ["id"],
                    properties: {
                        id: {
                            type: "string",
                            description: "ID của giảng viên",
                        },
                    },
                },
                response: {
                    200: {
                        description: "Lấy chi tiết giảng viên thành công",
                        ...TeacherResponseJsonSchema,
                    },
                    401: {
                        description: "Chưa đăng nhập hoặc token không hợp lệ",
                        ...ErrorResponseJsonSchema,
                    },
                    403: {
                        description: "Không có quyền truy cập (chỉ admin)",
                        ...ErrorResponseJsonSchema,
                    },
                    404: {
                        description: "Không tìm thấy giảng viên",
                        ...ErrorResponseJsonSchema,
                    },
                    500: {
                        description: "Lỗi hệ thống",
                        ...ErrorResponseJsonSchema,
                    },
                },
            },
        },
        async (request, reply) => {
            const result = await getTeacherDetailsUseCase.execute(request.params.id);

            if (result.success) {
                return reply.code(200).send(result.data);
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // PUT /api/v1/admin/teachers/:id - update teacher
    app.put<{ Params: { id: string }; Body: UpdateTeacherRequestDto }>(
        "/teachers/:id",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Cập nhật hồ sơ giảng viên",
                tags: ["admin-teachers"],
                security: [{ bearerAuth: [] }],
                params: {
                    type: "object",
                    required: ["id"],
                    properties: {
                        id: {
                            type: "string",
                            description: "ID của giảng viên",
                        },
                    },
                },
                body: UpdateTeacherBodyJsonSchema,
                response: {
                    200: {
                        description: "Cập nhật giảng viên thành công",
                        ...TeacherResponseJsonSchema,
                    },
                    400: {
                        description: "Dữ liệu đầu vào không hợp lệ",
                        ...ErrorResponseJsonSchema,
                    },
                    401: {
                        description: "Chưa đăng nhập hoặc token không hợp lệ",
                        ...ErrorResponseJsonSchema,
                    },
                    403: {
                        description: "Không có quyền truy cập (chỉ admin)",
                        ...ErrorResponseJsonSchema,
                    },
                    404: {
                        description: "Không tìm thấy giảng viên",
                        ...ErrorResponseJsonSchema,
                    },
                    409: {
                        description: "Mã giảng viên đã tồn tại",
                        ...ErrorResponseJsonSchema,
                    },
                    500: {
                        description: "Lỗi hệ thống",
                        ...ErrorResponseJsonSchema,
                    },
                },
            },
        },
        async (request, reply) => {
            const parseResult = UpdateTeacherRequestSchema.safeParse(request.body);

            if (!parseResult.success) {
                const firstError = parseResult.error.issues[0];
                return reply.code(400).send({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: firstError.message,
                    },
                });
            }

            const result = await updateTeacherUseCase.execute(request.params.id, parseResult.data);

            if (result.success) {
                return reply.code(200).send(result.data);
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // DELETE /api/v1/admin/teachers/:id - delete teacher
    app.delete<{ Params: { id: string } }>(
        "/teachers/:id",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Xóa hồ sơ giảng viên",
                tags: ["admin-teachers"],
                security: [{ bearerAuth: [] }],
                params: {
                    type: "object",
                    required: ["id"],
                    properties: {
                        id: {
                            type: "string",
                            description: "ID của giảng viên",
                        },
                    },
                },
                response: {
                    200: {
                        description: "Xóa giảng viên thành công",
                        ...MessageResponseJsonSchema,
                    },
                    401: {
                        description: "Chưa đăng nhập hoặc token không hợp lệ",
                        ...ErrorResponseJsonSchema,
                    },
                    403: {
                        description: "Không có quyền truy cập (chỉ admin)",
                        ...ErrorResponseJsonSchema,
                    },
                    404: {
                        description: "Không tìm thấy giảng viên",
                        ...ErrorResponseJsonSchema,
                    },
                    409: {
                        description: "Không thể xóa giảng viên còn dữ liệu phụ thuộc",
                        ...ErrorResponseJsonSchema,
                    },
                    500: {
                        description: "Lỗi hệ thống",
                        ...ErrorResponseJsonSchema,
                    },
                },
            },
        },
        async (request, reply) => {
            const result = await deleteTeacherUseCase.execute(request.params.id);

            if (result.success) {
                return reply.code(200).send({
                    message: "Xóa giảng viên thành công",
                });
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // POST /api/v1/admin/teachers/:id/link-account - link account to teacher
    app.post<{ Params: { id: string }; Body: LinkAccountRequestDto }>(
        "/teachers/:id/link-account",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Liên kết tài khoản với giảng viên",
                tags: ["admin-teachers"],
                security: [{ bearerAuth: [] }],
                params: {
                    type: "object",
                    required: ["id"],
                    properties: {
                        id: {
                            type: "string",
                            description: "ID của giảng viên",
                        },
                    },
                },
                body: LinkAccountBodyJsonSchema,
                response: {
                    200: {
                        description: "Liên kết tài khoản thành công",
                        ...MessageResponseJsonSchema,
                    },
                    400: {
                        description: "Dữ liệu đầu vào không hợp lệ",
                        ...ErrorResponseJsonSchema,
                    },
                    401: {
                        description: "Chưa đăng nhập hoặc token không hợp lệ",
                        ...ErrorResponseJsonSchema,
                    },
                    403: {
                        description: "Không có quyền truy cập (chỉ admin)",
                        ...ErrorResponseJsonSchema,
                    },
                    404: {
                        description: "Không tìm thấy giảng viên hoặc tài khoản",
                        ...ErrorResponseJsonSchema,
                    },
                    409: {
                        description: "Tài khoản đã được liên kết hoặc vai trò không khớp",
                        ...ErrorResponseJsonSchema,
                    },
                    500: {
                        description: "Lỗi hệ thống",
                        ...ErrorResponseJsonSchema,
                    },
                },
            },
        },
        async (request, reply) => {
            const parseResult = LinkAccountRequestSchema.safeParse(request.body);

            if (!parseResult.success) {
                const firstError = parseResult.error.issues[0];
                return reply.code(400).send({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: firstError.message,
                    },
                });
            }

            const result = await linkAccountUseCase.execute(
                request.params.id,
                parseResult.data.accountId,
            );

            if (result.success) {
                return reply.code(200).send({
                    message: "Liên kết tài khoản thành công",
                });
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // DELETE /api/v1/admin/teachers/:id/unlink-account - unlink account from teacher
    app.delete<{ Params: { id: string } }>(
        "/teachers/:id/unlink-account",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Hủy liên kết tài khoản khỏi giảng viên",
                tags: ["admin-teachers"],
                security: [{ bearerAuth: [] }],
                params: {
                    type: "object",
                    required: ["id"],
                    properties: {
                        id: {
                            type: "string",
                            description: "ID của giảng viên",
                        },
                    },
                },
                response: {
                    200: {
                        description: "Hủy liên kết tài khoản thành công",
                        ...MessageResponseJsonSchema,
                    },
                    401: {
                        description: "Chưa đăng nhập hoặc token không hợp lệ",
                        ...ErrorResponseJsonSchema,
                    },
                    403: {
                        description: "Không có quyền truy cập (chỉ admin)",
                        ...ErrorResponseJsonSchema,
                    },
                    404: {
                        description: "Không tìm thấy giảng viên",
                        ...ErrorResponseJsonSchema,
                    },
                    409: {
                        description: "Giảng viên chưa liên kết tài khoản",
                        ...ErrorResponseJsonSchema,
                    },
                    500: {
                        description: "Lỗi hệ thống",
                        ...ErrorResponseJsonSchema,
                    },
                },
            },
        },
        async (request, reply) => {
            const result = await unlinkAccountUseCase.execute(request.params.id);

            if (result.success) {
                return reply.code(200).send({
                    message: "Hủy liên kết tài khoản thành công",
                });
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
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
        case "INVALID_TEACHER_CODE":
        case "INVALID_FULL_NAME":
        case "INVALID_ACADEMIC_RANK":
        case "INVALID_ACADEMIC_DEGREE":
            return 400;
        case "UNAUTHORIZED":
            return 401;
        case "TEACHER_NOT_FOUND":
        case "DEPARTMENT_NOT_FOUND":
        case "ACCOUNT_NOT_FOUND":
            return 404;
        case "DUPLICATE_TEACHER_CODE":
        case "HAS_ADVISOR_ASSIGNMENTS":
        case "ACCOUNT_ALREADY_LINKED":
        case "ACCOUNT_ROLE_MISMATCH":
        case "TEACHER_NOT_LINKED":
            return 409;
        case "INTERNAL_ERROR":
        default:
            return 500;
    }
}
