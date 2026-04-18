import type { FastifyInstance } from "fastify";
import { AdminContainer } from "../../../Container.js";
import {
    CreateDepartmentRequestSchema,
    UpdateDepartmentRequestSchema,
    ListDepartmentsQuerySchema,
    type CreateDepartmentRequestDto,
    type UpdateDepartmentRequestDto,
    type ListDepartmentsQueryDto,
    CreateDepartmentBodyJsonSchema,
    UpdateDepartmentBodyJsonSchema,
    ListDepartmentsQueryJsonSchema,
    DepartmentResponseJsonSchema,
    ListDepartmentsResponseJsonSchema,
    ErrorResponseJsonSchema,
    MessageResponseJsonSchema,
} from "./Dto.js";

/**
 * Department module HTTP routes
 */
export async function departmentRoutes(app: FastifyInstance) {
    const container = new AdminContainer(app.prisma);

    // POST /api/v1/admin/departments - create department
    app.post<{ Body: CreateDepartmentRequestDto }>(
        "/departments",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Tạo bộ môn mới",
                tags: ["admin-departments"],
                security: [{ bearerAuth: [] }],
                body: CreateDepartmentBodyJsonSchema,
                response: {
                    201: {
                        description: "Tạo bộ môn thành công",
                        ...DepartmentResponseJsonSchema,
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
                        description: "Mã bộ môn đã tồn tại",
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
            const parseResult = CreateDepartmentRequestSchema.safeParse(request.body);

            if (!parseResult.success) {
                const firstError = parseResult.error.issues[0];
                return reply.code(400).send({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: firstError.message,
                    },
                });
            }

            const result = await container.createDepartmentUseCase.execute(parseResult.data);

            if (result.success) {
                return reply.code(201).send(result.data);
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // GET /api/v1/admin/departments - list departments with pagination, search, and filters
    app.get<{ Querystring: ListDepartmentsQueryDto }>(
        "/departments",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Lấy danh sách bộ môn, sắp xếp theo cập nhật mới nhất",
                tags: ["admin-departments"],
                security: [{ bearerAuth: [] }],
                querystring: ListDepartmentsQueryJsonSchema,
                response: {
                    200: {
                        description: "Lấy danh sách bộ môn thành công",
                        ...ListDepartmentsResponseJsonSchema,
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
            const parseResult = ListDepartmentsQuerySchema.safeParse(request.query);

            if (!parseResult.success) {
                const firstError = parseResult.error.issues[0];
                return reply.code(400).send({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: firstError.message,
                    },
                });
            }

            const result = await container.listDepartmentsUseCase.execute(parseResult.data);

            if (result.success) {
                return reply.code(200).send(result.data);
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // GET /api/v1/admin/departments/:id - get department by id
    app.get<{ Params: { id: string } }>(
        "/departments/:id",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Lấy chi tiết bộ môn theo ID",
                tags: ["admin-departments"],
                security: [{ bearerAuth: [] }],
                params: {
                    type: "object",
                    required: ["id"],
                    properties: {
                        id: {
                            type: "string",
                            description: "ID của bộ môn",
                        },
                    },
                },
                response: {
                    200: {
                        description: "Lấy chi tiết bộ môn thành công",
                        ...DepartmentResponseJsonSchema,
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
                        description: "Không tìm thấy bộ môn",
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
            const result = await container.getDepartmentByIdUseCase.execute(request.params.id);

            if (result.success) {
                return reply.code(200).send(result.data);
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // PUT /api/v1/admin/departments/:id - update department
    app.put<{ Params: { id: string }; Body: UpdateDepartmentRequestDto }>(
        "/departments/:id",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Cập nhật bộ môn",
                tags: ["admin-departments"],
                security: [{ bearerAuth: [] }],
                params: {
                    type: "object",
                    required: ["id"],
                    properties: {
                        id: {
                            type: "string",
                            description: "ID của bộ môn",
                        },
                    },
                },
                body: UpdateDepartmentBodyJsonSchema,
                response: {
                    200: {
                        description: "Cập nhật bộ môn thành công",
                        ...DepartmentResponseJsonSchema,
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
                        description: "Không tìm thấy bộ môn hoặc khoa",
                        ...ErrorResponseJsonSchema,
                    },
                    409: {
                        description: "Mã bộ môn đã tồn tại",
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
            const parseResult = UpdateDepartmentRequestSchema.safeParse(request.body);

            if (!parseResult.success) {
                const firstError = parseResult.error.issues[0];
                return reply.code(400).send({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: firstError.message,
                    },
                });
            }

            const result = await container.updateDepartmentUseCase.execute(request.params.id, parseResult.data);

            if (result.success) {
                return reply.code(200).send(result.data);
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // DELETE /api/v1/admin/departments/:id - delete department
    app.delete<{ Params: { id: string } }>(
        "/departments/:id",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Xóa bộ môn",
                tags: ["admin-departments"],
                security: [{ bearerAuth: [] }],
                params: {
                    type: "object",
                    required: ["id"],
                    properties: {
                        id: {
                            type: "string",
                            description: "ID của bộ môn",
                        },
                    },
                },
                response: {
                    200: {
                        description: "Xóa bộ môn thành công",
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
                        description: "Không tìm thấy bộ môn",
                        ...ErrorResponseJsonSchema,
                    },
                    409: {
                        description: "Không thể xóa bộ môn còn dữ liệu phụ thuộc",
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
            const result = await container.deleteDepartmentUseCase.execute(request.params.id);

            if (result.success) {
                return reply.code(200).send({
                    message: "Xóa bộ môn thành công",
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
        case "DEPARTMENT_NOT_FOUND":
        case "FACULTY_NOT_FOUND":
            return 404;
        case "DUPLICATE_CODE":
        case "HAS_LINKED_TEACHERS":
            return 409;
        case "INTERNAL_ERROR":
        default:
            return 500;
    }
}
