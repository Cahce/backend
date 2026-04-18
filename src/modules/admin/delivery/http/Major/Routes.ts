import type { FastifyInstance } from "fastify";
import { AdminContainer } from "../../../Container.js";
import {
    CreateMajorRequestSchema,
    UpdateMajorRequestSchema,
    ListMajorsQuerySchema,
    type CreateMajorRequestDto,
    type UpdateMajorRequestDto,
    type ListMajorsQueryDto,
    CreateMajorBodyJsonSchema,
    UpdateMajorBodyJsonSchema,
    ListMajorsQueryJsonSchema,
    MajorResponseJsonSchema,
    ListMajorsResponseJsonSchema,
    ErrorResponseJsonSchema,
    MessageResponseJsonSchema,
} from "./Dto.js";

/**
 * Major module HTTP routes
 */
export async function majorRoutes(app: FastifyInstance) {
    const container = new AdminContainer(app.prisma);

    // POST /api/v1/admin/majors - create major
    app.post<{ Body: CreateMajorRequestDto }>(
        "/majors",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Tạo ngành mới",
                tags: ["admin-majors"],
                security: [{ bearerAuth: [] }],
                body: CreateMajorBodyJsonSchema,
                response: {
                    201: {
                        description: "Tạo ngành thành công",
                        ...MajorResponseJsonSchema,
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
                        description: "Không tìm thấy khoa",
                        ...ErrorResponseJsonSchema,
                    },
                    409: {
                        description: "Mã ngành đã tồn tại",
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
            const parseResult = CreateMajorRequestSchema.safeParse(request.body);

            if (!parseResult.success) {
                const firstError = parseResult.error.issues[0];
                return reply.code(400).send({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: firstError.message,
                    },
                });
            }

            const result = await container.createMajorUseCase.execute(parseResult.data);

            if (result.success) {
                return reply.code(201).send(result.data);
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // GET /api/v1/admin/majors - list majors with pagination, search, and filters
    app.get<{ Querystring: ListMajorsQueryDto }>(
        "/majors",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Lấy danh sách ngành, sắp xếp theo cập nhật mới nhất",
                tags: ["admin-majors"],
                security: [{ bearerAuth: [] }],
                querystring: ListMajorsQueryJsonSchema,
                response: {
                    200: {
                        description: "Lấy danh sách ngành thành công",
                        ...ListMajorsResponseJsonSchema,
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
            const parseResult = ListMajorsQuerySchema.safeParse(request.query);

            if (!parseResult.success) {
                const firstError = parseResult.error.issues[0];
                return reply.code(400).send({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: firstError.message,
                    },
                });
            }

            const result = await container.listMajorsUseCase.execute(parseResult.data);

            if (result.success) {
                return reply.code(200).send(result.data);
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // GET /api/v1/admin/majors/:id - get major by id
    app.get<{ Params: { id: string } }>(
        "/majors/:id",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Lấy chi tiết ngành theo ID",
                tags: ["admin-majors"],
                security: [{ bearerAuth: [] }],
                params: {
                    type: "object",
                    required: ["id"],
                    properties: {
                        id: {
                            type: "string",
                            description: "ID của ngành",
                        },
                    },
                },
                response: {
                    200: {
                        description: "Lấy chi tiết ngành thành công",
                        ...MajorResponseJsonSchema,
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
                    500: {
                        description: "Lỗi hệ thống",
                        ...ErrorResponseJsonSchema,
                    },
                },
            },
        },
        async (request, reply) => {
            const result = await container.getMajorByIdUseCase.execute(request.params.id);

            if (result.success) {
                return reply.code(200).send(result.data);
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // PUT /api/v1/admin/majors/:id - update major
    app.put<{ Params: { id: string }; Body: UpdateMajorRequestDto }>(
        "/majors/:id",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Cập nhật ngành",
                tags: ["admin-majors"],
                security: [{ bearerAuth: [] }],
                params: {
                    type: "object",
                    required: ["id"],
                    properties: {
                        id: {
                            type: "string",
                            description: "ID của ngành",
                        },
                    },
                },
                body: UpdateMajorBodyJsonSchema,
                response: {
                    200: {
                        description: "Cập nhật ngành thành công",
                        ...MajorResponseJsonSchema,
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
                        description: "Không tìm thấy ngành hoặc khoa",
                        ...ErrorResponseJsonSchema,
                    },
                    409: {
                        description: "Mã ngành đã tồn tại",
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
            const parseResult = UpdateMajorRequestSchema.safeParse(request.body);

            if (!parseResult.success) {
                const firstError = parseResult.error.issues[0];
                return reply.code(400).send({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: firstError.message,
                    },
                });
            }

            const result = await container.updateMajorUseCase.execute(request.params.id, parseResult.data);

            if (result.success) {
                return reply.code(200).send(result.data);
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // DELETE /api/v1/admin/majors/:id - delete major
    app.delete<{ Params: { id: string } }>(
        "/majors/:id",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Xóa ngành",
                tags: ["admin-majors"],
                security: [{ bearerAuth: [] }],
                params: {
                    type: "object",
                    required: ["id"],
                    properties: {
                        id: {
                            type: "string",
                            description: "ID của ngành",
                        },
                    },
                },
                response: {
                    200: {
                        description: "Xóa ngành thành công",
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
                        description: "Không tìm thấy ngành",
                        ...ErrorResponseJsonSchema,
                    },
                    409: {
                        description: "Không thể xóa ngành còn dữ liệu phụ thuộc",
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
            const result = await container.deleteMajorUseCase.execute(request.params.id);

            if (result.success) {
                return reply.code(200).send({
                    message: "Xóa ngành thành công",
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
        case "MAJOR_NOT_FOUND":
        case "FACULTY_NOT_FOUND":
            return 404;
        case "DUPLICATE_CODE":
        case "HAS_CHILD_CLASSES":
            return 409;
        case "INTERNAL_ERROR":
        default:
            return 500;
    }
}
