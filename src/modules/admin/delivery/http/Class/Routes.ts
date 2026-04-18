import type { FastifyInstance } from "fastify";
import { AdminContainer } from "../../../Container.js";
import {
    CreateClassRequestSchema,
    UpdateClassRequestSchema,
    ListClassesQuerySchema,
    type CreateClassRequestDto,
    type UpdateClassRequestDto,
    type ListClassesQueryDto,
    CreateClassBodyJsonSchema,
    UpdateClassBodyJsonSchema,
    ListClassesQueryJsonSchema,
    ClassResponseJsonSchema,
    ListClassesResponseJsonSchema,
    ErrorResponseJsonSchema,
    MessageResponseJsonSchema,
} from "./Dto.js";

/**
 * Class module HTTP routes
 */
export async function classRoutes(app: FastifyInstance) {
    const container = new AdminContainer(app.prisma);

    // POST /api/v1/admin/classes - create class
    app.post<{ Body: CreateClassRequestDto }>(
        "/classes",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Tạo lớp mới",
                tags: ["admin-classes"],
                security: [{ bearerAuth: [] }],
                body: CreateClassBodyJsonSchema,
                response: {
                    201: {
                        description: "Tạo lớp thành công",
                        ...ClassResponseJsonSchema,
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
                        description: "Không tìm thấy ngành",
                        ...ErrorResponseJsonSchema,
                    },
                    409: {
                        description: "Mã lớp đã tồn tại",
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
            const parseResult = CreateClassRequestSchema.safeParse(request.body);

            if (!parseResult.success) {
                const firstError = parseResult.error.issues[0];
                return reply.code(400).send({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: firstError.message,
                    },
                });
            }

            const result = await container.createClassUseCase.execute(parseResult.data);

            if (result.success) {
                return reply.code(201).send(result.data);
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // GET /api/v1/admin/classes - list classes with pagination, search, and filters
    app.get<{ Querystring: ListClassesQueryDto }>(
        "/classes",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Lấy danh sách lớp, sắp xếp theo cập nhật mới nhất",
                tags: ["admin-classes"],
                security: [{ bearerAuth: [] }],
                querystring: ListClassesQueryJsonSchema,
                response: {
                    200: {
                        description: "Lấy danh sách lớp thành công",
                        ...ListClassesResponseJsonSchema,
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
            const parseResult = ListClassesQuerySchema.safeParse(request.query);

            if (!parseResult.success) {
                const firstError = parseResult.error.issues[0];
                return reply.code(400).send({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: firstError.message,
                    },
                });
            }

            const result = await container.listClassesUseCase.execute(parseResult.data);

            if (result.success) {
                return reply.code(200).send(result.data);
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // GET /api/v1/admin/classes/:id - get class by id
    app.get<{ Params: { id: string } }>(
        "/classes/:id",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Lấy chi tiết lớp theo ID",
                tags: ["admin-classes"],
                security: [{ bearerAuth: [] }],
                params: {
                    type: "object",
                    required: ["id"],
                    properties: {
                        id: {
                            type: "string",
                            description: "ID của lớp",
                        },
                    },
                },
                response: {
                    200: {
                        description: "Lấy chi tiết lớp thành công",
                        ...ClassResponseJsonSchema,
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
                        description: "Không tìm thấy lớp",
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
            const result = await container.getClassByIdUseCase.execute(request.params.id);

            if (result.success) {
                return reply.code(200).send(result.data);
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // PUT /api/v1/admin/classes/:id - update class
    app.put<{ Params: { id: string }; Body: UpdateClassRequestDto }>(
        "/classes/:id",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Cập nhật lớp",
                tags: ["admin-classes"],
                security: [{ bearerAuth: [] }],
                params: {
                    type: "object",
                    required: ["id"],
                    properties: {
                        id: {
                            type: "string",
                            description: "ID của lớp",
                        },
                    },
                },
                body: UpdateClassBodyJsonSchema,
                response: {
                    200: {
                        description: "Cập nhật lớp thành công",
                        ...ClassResponseJsonSchema,
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
                        description: "Không tìm thấy lớp hoặc ngành",
                        ...ErrorResponseJsonSchema,
                    },
                    409: {
                        description: "Mã lớp đã tồn tại",
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
            const parseResult = UpdateClassRequestSchema.safeParse(request.body);

            if (!parseResult.success) {
                const firstError = parseResult.error.issues[0];
                return reply.code(400).send({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: firstError.message,
                    },
                });
            }

            const result = await container.updateClassUseCase.execute(request.params.id, parseResult.data);

            if (result.success) {
                return reply.code(200).send(result.data);
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // DELETE /api/v1/admin/classes/:id - delete class
    app.delete<{ Params: { id: string } }>(
        "/classes/:id",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Xóa lớp",
                tags: ["admin-classes"],
                security: [{ bearerAuth: [] }],
                params: {
                    type: "object",
                    required: ["id"],
                    properties: {
                        id: {
                            type: "string",
                            description: "ID của lớp",
                        },
                    },
                },
                response: {
                    200: {
                        description: "Xóa lớp thành công",
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
                        description: "Không tìm thấy lớp",
                        ...ErrorResponseJsonSchema,
                    },
                    409: {
                        description: "Không thể xóa lớp còn dữ liệu phụ thuộc",
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
            const result = await container.deleteClassUseCase.execute(request.params.id);

            if (result.success) {
                return reply.code(200).send({
                    message: "Xóa lớp thành công",
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
            return 400;
        case "UNAUTHORIZED":
            return 401;
        case "CLASS_NOT_FOUND":
        case "MAJOR_NOT_FOUND":
            return 404;
        case "DUPLICATE_CODE":
        case "HAS_LINKED_STUDENTS":
            return 409;
        case "INTERNAL_ERROR":
        default:
            return 500;
    }
}
