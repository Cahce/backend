import type { FastifyInstance } from "fastify";
import { AdminContainer } from "../../../Container.js";
import { FileParser } from "../../../infra/FileParser.js";
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
    const importMajors = container.importMajors;

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

    // POST /api/v1/admin/majors/import - import majors from XLSX or CSV file
    app.post(
        "/majors/import",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Nhập danh sách ngành từ file XLSX (ưu tiên) hoặc CSV (fallback)",
                tags: ["admin-majors"],
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
                const result = await importMajors.execute(parsed.rows);

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

    // GET /api/v1/admin/majors/import/template - download template
    app.get<{ Querystring: { format?: "xlsx" | "csv" } }>(
        "/majors/import/template",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Tải file mẫu XLSX (mặc định) hoặc CSV để nhập ngành",
                tags: ["admin-majors"],
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
            const headers = ["STT", "Khoa", "Mã Ngành", "Ngành"];
            const exampleRow = {
                STT: "1",
                Khoa: "CNTT",
                "Mã Ngành": "7480103",
                "Ngành": "Kỹ thuật phần mềm",
            };

            if (format === "xlsx") {
                const buffer = FileParser.buildXlsxTemplate(headers, exampleRow);

                return reply
                    .header(
                        "Content-Type",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    )
                    .header("Content-Disposition", 'attachment; filename="nganh_mau.xlsx"')
                    .send(buffer);
            } else {
                const template = FileParser.buildCsvTemplate(headers, exampleRow);

                return reply
                    .header("Content-Type", "text/csv; charset=utf-8")
                    .header("Content-Disposition", 'attachment; filename="nganh_mau.csv"')
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
