import type { FastifyInstance } from "fastify";
import { AdminContainer } from "../../../Container.js";
import { FileParser } from "../../../infra/FileParser.js";
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
    const container = new AdminContainer(app.prisma);
    const {
        createFacultyUseCase,
        listFacultiesUseCase,
        getFacultyByIdUseCase,
        updateFacultyUseCase,
        deleteFacultyUseCase,
        importFaculties,
    } = container;

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

    // POST /api/v1/admin/faculties/import - import faculties from XLSX or CSV file
    app.post(
        "/faculties/import",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Nhập danh sách khoa từ file XLSX (ưu tiên) hoặc CSV (fallback)",
                tags: ["admin-faculties"],
                security: [{ bearerAuth: [] }],
                consumes: ["multipart/form-data"],
                response: {
                    200: {
                        description: "Kết quả nhập file",
                        type: "object",
                        properties: {
                            total: { type: "number", description: "Tổng số dòng" },
                            created: { type: "number", description: "Số dòng tạo thành công" },
                            skipped: { type: "number", description: "Số dòng bỏ qua (đã tồn tại)" },
                            failed: { type: "number", description: "Số dòng lỗi" },
                            errors: {
                                type: "array",
                                description: "Danh sách lỗi",
                                items: {
                                    type: "object",
                                    properties: {
                                        row: { type: "number" },
                                        code: { type: "string" },
                                        message: { type: "string" },
                                    },
                                },
                            },
                        },
                    },
                    400: {
                        description: "File không hợp lệ",
                        ...ErrorResponseJsonSchema,
                    },
                    401: {
                        description: "Chưa đăng nhập",
                        ...ErrorResponseJsonSchema,
                    },
                    403: {
                        description: "Không có quyền (chỉ admin)",
                        ...ErrorResponseJsonSchema,
                    },
                    413: {
                        description: "File quá lớn",
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
            try {
                const data = await request.file();

                if (!data) {
                    return reply.code(400).send({
                        error: {
                            code: "NO_FILE",
                            message: "Không tìm thấy file",
                        },
                    });
                }

                // Validate MIME type
                const mimeValidation = FileParser.validateMimeType(data.mimetype);
                if (!mimeValidation.valid) {
                    return reply.code(400).send({
                        error: {
                            code: "INVALID_FILE_TYPE",
                            message: "Chỉ chấp nhận file XLSX hoặc CSV",
                        },
                    });
                }

                // Reject .xlsm files (with macros)
                if (data.filename.toLowerCase().endsWith(".xlsm")) {
                    return reply.code(400).send({
                        error: {
                            code: "INVALID_FILE_TYPE",
                            message: "Không chấp nhận file .xlsm (có macro). Vui lòng sử dụng file .xlsx",
                        },
                    });
                }

                // Read file buffer
                const buffer = await data.toBuffer();

                // Check file size (5MB limit)
                const maxSize = 5 * 1024 * 1024; // 5MB
                if (buffer.length > maxSize) {
                    return reply.code(413).send({
                        error: {
                            code: "FILE_TOO_LARGE",
                            message: "File quá lớn. Kích thước tối đa: 5MB",
                        },
                    });
                }

                // Parse file (auto-detect XLSX or CSV)
                const parsed = FileParser.parseSpreadsheet(buffer, data.mimetype);

                // Check row limit (5000 rows)
                const maxRows = 5000;
                if (parsed.rows.length > maxRows) {
                    return reply.code(413).send({
                        error: {
                            code: "TOO_MANY_ROWS",
                            message: `File có quá nhiều dòng. Tối đa: ${maxRows} dòng`,
                        },
                    });
                }

                // Execute import
                const result = await importFaculties.execute(parsed.rows);

                return reply.code(200).send(result);
            } catch (error) {
                return reply.code(400).send({
                    error: {
                        code: "IMPORT_ERROR",
                        message: error instanceof Error ? error.message : "Lỗi nhập file",
                    },
                });
            }
        },
    );

    // GET /api/v1/admin/faculties/import/template - download template
    app.get<{ Querystring: { format?: "xlsx" | "csv" } }>(
        "/faculties/import/template",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Tải file mẫu XLSX (mặc định) hoặc CSV để nhập khoa",
                tags: ["admin-faculties"],
                security: [{ bearerAuth: [] }],
                querystring: {
                    type: "object",
                    properties: {
                        format: {
                            type: "string",
                            enum: ["xlsx", "csv"],
                            description: "Định dạng file mẫu (mặc định: xlsx)",
                        },
                    },
                },
                response: {
                    200: {
                        description: "File mẫu",
                        type: "string",
                    },
                    401: {
                        description: "Chưa đăng nhập",
                        ...ErrorResponseJsonSchema,
                    },
                    403: {
                        description: "Không có quyền (chỉ admin)",
                        ...ErrorResponseJsonSchema,
                    },
                },
            },
        },
        async (request, reply) => {
            const format = request.query.format || "xlsx";
            const headers = ["STT", "Mã khoa", "Tên khoa"];
            const exampleRow = {
                STT: "1",
                "Mã khoa": "CNTT",
                "Tên khoa": "Công nghệ Thông tin",
            };

            if (format === "xlsx") {
                const buffer = FileParser.buildXlsxTemplate(headers, exampleRow);

                return reply
                    .header(
                        "Content-Type",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    )
                    .header("Content-Disposition", 'attachment; filename="khoa_mau.xlsx"')
                    .send(buffer);
            } else {
                const template = FileParser.buildCsvTemplate(headers, exampleRow);

                return reply
                    .header("Content-Type", "text/csv; charset=utf-8")
                    .header("Content-Disposition", 'attachment; filename="khoa_mau.csv"')
                    .send(template);
            }
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
