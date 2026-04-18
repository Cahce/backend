import type { FastifyInstance } from "fastify";
import { CreateFacultyUseCase } from "../../../application/Faculty/CreateFacultyUseCase.js";
import { ListFacultiesUseCase } from "../../../application/Faculty/ListFacultiesUseCase.js";
import { GetFacultyByIdUseCase } from "../../../application/Faculty/GetFacultyByIdUseCase.js";
import { UpdateFacultyUseCase } from "../../../application/Faculty/UpdateFacultyUseCase.js";
import { DeleteFacultyUseCase } from "../../../application/Faculty/DeleteFacultyUseCase.js";
import { FacultyRepoPrisma } from "../../../infra/FacultyRepoPrisma.js";
import {
    CreateFacultyRequestSchema,
    UpdateFacultyRequestSchema,
    ListFacultiesQuerySchema,
    type CreateFacultyRequestDto,
    type UpdateFacultyRequestDto,
    type ListFacultiesQueryDto,
    CreateFacultyBodyJsonSchema,
    UpdateFacultyBodyJsonSchema,
    ListFacultiesQueryJsonSchema,
    FacultyResponseJsonSchema,
    ListFacultiesResponseJsonSchema,
    ErrorResponseJsonSchema,
    MessageResponseJsonSchema,
} from "./Dto.js";

/**
 * Faculty module HTTP routes
 */
export async function facultyRoutes(app: FastifyInstance) {
    const facultyRepo = new FacultyRepoPrisma(app.prisma);
    const createFacultyUseCase = new CreateFacultyUseCase(facultyRepo);
    const listFacultiesUseCase = new ListFacultiesUseCase(facultyRepo);
    const getFacultyByIdUseCase = new GetFacultyByIdUseCase(facultyRepo);
    const updateFacultyUseCase = new UpdateFacultyUseCase(facultyRepo);
    const deleteFacultyUseCase = new DeleteFacultyUseCase(facultyRepo);

    // POST /api/v1/admin/faculties - create faculty
    app.post<{ Body: CreateFacultyRequestDto }>(
        "/faculties",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Tạo khoa mới",
                tags: ["admin-faculties"],
                security: [{ bearerAuth: [] }],
                body: CreateFacultyBodyJsonSchema,
                response: {
                    201: {
                        description: "Tạo khoa thành công",
                        ...FacultyResponseJsonSchema,
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
                        description: "Mã khoa đã tồn tại",
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
            const parseResult = CreateFacultyRequestSchema.safeParse(request.body);

            if (!parseResult.success) {
                const firstError = parseResult.error.issues[0];
                return reply.code(400).send({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: firstError.message,
                    },
                });
            }

            const result = await createFacultyUseCase.execute(parseResult.data);

            if (result.success) {
                return reply.code(201).send(result.data);
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // GET /api/v1/admin/faculties - list faculties with pagination and search
    app.get<{ Querystring: ListFacultiesQueryDto }>(
        "/faculties",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Lấy danh sách khoa, sắp xếp theo cập nhật mới nhất",
                tags: ["admin-faculties"],
                security: [{ bearerAuth: [] }],
                querystring: ListFacultiesQueryJsonSchema,
                response: {
                    200: {
                        description: "Lấy danh sách khoa thành công",
                        ...ListFacultiesResponseJsonSchema,
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
            const parseResult = ListFacultiesQuerySchema.safeParse(request.query);

            if (!parseResult.success) {
                const firstError = parseResult.error.issues[0];
                return reply.code(400).send({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: firstError.message,
                    },
                });
            }

            const result = await listFacultiesUseCase.execute(parseResult.data);

            if (result.success) {
                return reply.code(200).send(result.data);
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // GET /api/v1/admin/faculties/:id - get faculty by id
    app.get<{ Params: { id: string } }>(
        "/faculties/:id",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Lấy chi tiết khoa theo ID",
                tags: ["admin-faculties"],
                security: [{ bearerAuth: [] }],
                params: {
                    type: "object",
                    required: ["id"],
                    properties: {
                        id: {
                            type: "string",
                            description: "ID của khoa",
                        },
                    },
                },
                response: {
                    200: {
                        description: "Lấy chi tiết khoa thành công",
                        ...FacultyResponseJsonSchema,
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
                    500: {
                        description: "Lỗi hệ thống",
                        ...ErrorResponseJsonSchema,
                    },
                },
            },
        },
        async (request, reply) => {
            const result = await getFacultyByIdUseCase.execute(request.params.id);

            if (result.success) {
                return reply.code(200).send(result.data);
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // PUT /api/v1/admin/faculties/:id - update faculty
    app.put<{ Params: { id: string }; Body: UpdateFacultyRequestDto }>(
        "/faculties/:id",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Cập nhật khoa",
                tags: ["admin-faculties"],
                security: [{ bearerAuth: [] }],
                params: {
                    type: "object",
                    required: ["id"],
                    properties: {
                        id: {
                            type: "string",
                            description: "ID của khoa",
                        },
                    },
                },
                body: UpdateFacultyBodyJsonSchema,
                response: {
                    200: {
                        description: "Cập nhật khoa thành công",
                        ...FacultyResponseJsonSchema,
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
                        description: "Mã khoa đã tồn tại",
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
            const parseResult = UpdateFacultyRequestSchema.safeParse(request.body);

            if (!parseResult.success) {
                const firstError = parseResult.error.issues[0];
                return reply.code(400).send({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: firstError.message,
                    },
                });
            }

            const result = await updateFacultyUseCase.execute(request.params.id, parseResult.data);

            if (result.success) {
                return reply.code(200).send(result.data);
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // DELETE /api/v1/admin/faculties/:id - delete faculty
    app.delete<{ Params: { id: string } }>(
        "/faculties/:id",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Xóa khoa",
                tags: ["admin-faculties"],
                security: [{ bearerAuth: [] }],
                params: {
                    type: "object",
                    required: ["id"],
                    properties: {
                        id: {
                            type: "string",
                            description: "ID của khoa",
                        },
                    },
                },
                response: {
                    200: {
                        description: "Xóa khoa thành công",
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
                        description: "Không tìm thấy khoa",
                        ...ErrorResponseJsonSchema,
                    },
                    409: {
                        description: "Không thể xóa khoa còn dữ liệu phụ thuộc",
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
            const result = await deleteFacultyUseCase.execute(request.params.id);

            if (result.success) {
                return reply.code(200).send({
                    message: "Xóa khoa thành công",
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
        case "FACULTY_NOT_FOUND":
            return 404;
        case "DUPLICATE_CODE":
        case "HAS_CHILD_DEPARTMENTS":
        case "HAS_CHILD_MAJORS":
            return 409;
        case "INTERNAL_ERROR":
        default:
            return 500;
    }
}
