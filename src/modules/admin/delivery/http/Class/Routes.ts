import type { FastifyInstance } from "fastify";
import { AdminContainer } from "../../../Container.js";
import { FileParser } from "../../../infra/FileParser.js";
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
    const importClasses = container.importClasses;

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

    // POST /api/v1/admin/classes/import - import classes from XLSX or CSV file
    app.post(
        "/classes/import",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Nhập danh sách lớp từ file XLSX (ưu tiên) hoặc CSV (fallback)",
                tags: ["admin-classes"],
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
                const result = await importClasses.execute(parsed.rows);

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

    // GET /api/v1/admin/classes/import/template - download template
    app.get<{ Querystring: { format?: "xlsx" | "csv" } }>(
        "/classes/import/template",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Tải file mẫu XLSX (mặc định) hoặc CSV để nhập lớp",
                tags: ["admin-classes"],
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
            const headers = ["STT", "Ngành", "Mã Lớp", "Lớp"];
            const exampleRow = {
                STT: "1",
                "Ngành": "7480103",
                "Mã Lớp": "62TH1",
                "Lớp": "Tin học 1",
            };

            if (format === "xlsx") {
                const buffer = FileParser.buildXlsxTemplate(headers, exampleRow);

                return reply
                    .header(
                        "Content-Type",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    )
                    .header("Content-Disposition", 'attachment; filename="lop_mau.xlsx"')
                    .send(buffer);
            } else {
                const template = FileParser.buildCsvTemplate(headers, exampleRow);

                return reply
                    .header("Content-Type", "text/csv; charset=utf-8")
                    .header("Content-Disposition", 'attachment; filename="lop_mau.csv"')
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
