import type { FastifyInstance } from "fastify";
import { AdminContainer } from "../../../Container.js";
import { FileParser } from "../../../infra/FileParser.js";
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
    const importDepartments = container.importDepartments;

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

    // POST /api/v1/admin/departments/import - import departments from XLSX or CSV file
    app.post(
        "/departments/import",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Nhập danh sách bộ môn từ file XLSX (ưu tiên) hoặc CSV (fallback)",
                tags: ["admin-departments"],
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
                const result = await importDepartments.execute(parsed.rows);

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

    // GET /api/v1/admin/departments/import/template - download template
    app.get<{ Querystring: { format?: "xlsx" | "csv" } }>(
        "/departments/import/template",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Tải file mẫu XLSX (mặc định) hoặc CSV để nhập bộ môn",
                tags: ["admin-departments"],
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
            const headers = ["STT", "Khoa", "Mã Bộ Môn", "Bộ Môn"];
            const exampleRow = {
                STT: "1",
                Khoa: "CNTT",
                "Mã Bộ Môn": "KTPM",
                "Bộ Môn": "Kỹ thuật phần mềm",
            };

            if (format === "xlsx") {
                const buffer = FileParser.buildXlsxTemplate(headers, exampleRow);

                return reply
                    .header(
                        "Content-Type",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    )
                    .header("Content-Disposition", 'attachment; filename="bo_mon_mau.xlsx"')
                    .send(buffer);
            } else {
                const template = FileParser.buildCsvTemplate(headers, exampleRow);

                return reply
                    .header("Content-Type", "text/csv; charset=utf-8")
                    .header("Content-Disposition", 'attachment; filename="bo_mon_mau.csv"')
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
