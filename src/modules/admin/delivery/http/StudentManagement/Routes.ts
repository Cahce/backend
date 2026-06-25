import type { FastifyInstance } from "fastify";
import { AdminContainer } from "../../../Container.js";
import { FileParser } from "../../../infra/FileParser.js";
import {
    CreateStudentRequestSchema,
    UpdateStudentRequestSchema,
    ListStudentsQuerySchema,
    LinkAccountRequestSchema,
    type CreateStudentRequestDto,
    type UpdateStudentRequestDto,
    type ListStudentsQueryDto,
    type LinkAccountRequestDto,
    CreateStudentBodyJsonSchema,
    UpdateStudentBodyJsonSchema,
    ListStudentsQueryJsonSchema,
    LinkAccountBodyJsonSchema,
    StudentResponseJsonSchema,
    ListStudentsResponseJsonSchema,
    ErrorResponseJsonSchema,
    MessageResponseJsonSchema,
} from "./Dto.js";

/**
 * Student Management module HTTP routes
 */
export async function studentManagementRoutes(app: FastifyInstance) {
    const container = new AdminContainer(app.prisma);
    const createStudentUseCase = container.createStudentProfileUseCase;
    const listStudentsUseCase = container.listStudentProfilesUseCase;
    const getStudentDetailsUseCase = container.getStudentProfileDetailsUseCase;
    const updateStudentUseCase = container.updateStudentProfileUseCase;
    const deleteStudentUseCase = container.deleteStudentProfileUseCase;
    const linkAccountUseCase = container.linkAccountToStudentUseCase;
    const unlinkAccountUseCase = container.unlinkAccountFromStudentUseCase;
    const importStudents = container.importStudents;

    // POST /api/v1/admin/students - create student
    app.post<{ Body: CreateStudentRequestDto }>(
        "/students",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Tạo hồ sơ sinh viên mới",
                tags: ["admin-students"],
                security: [{ bearerAuth: [] }],
                body: CreateStudentBodyJsonSchema,
                response: {
                    201: {
                        description: "Tạo sinh viên thành công",
                        ...StudentResponseJsonSchema,
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
                        description: "Mã sinh viên đã tồn tại",
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
            const parseResult = CreateStudentRequestSchema.safeParse(request.body);

            if (!parseResult.success) {
                const firstError = parseResult.error.issues[0];
                return reply.code(400).send({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: firstError.message,
                    },
                });
            }

            const result = await createStudentUseCase.execute(parseResult.data);

            if (result.success) {
                return reply.code(201).send(result.data);
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // GET /api/v1/admin/students - list students with pagination and filters
    app.get<{ Querystring: ListStudentsQueryDto }>(
        "/students",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Lấy danh sách sinh viên, sắp xếp theo cập nhật mới nhất",
                tags: ["admin-students"],
                security: [{ bearerAuth: [] }],
                querystring: ListStudentsQueryJsonSchema,
                response: {
                    200: {
                        description: "Lấy danh sách sinh viên thành công",
                        ...ListStudentsResponseJsonSchema,
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
            const parseResult = ListStudentsQuerySchema.safeParse(request.query);

            if (!parseResult.success) {
                const firstError = parseResult.error.issues[0];
                return reply.code(400).send({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: firstError.message,
                    },
                });
            }

            const result = await listStudentsUseCase.execute(parseResult.data);

            if (result.success) {
                return reply.code(200).send(result.data);
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // GET /api/v1/admin/students/:id - get student by id
    app.get<{ Params: { id: string } }>(
        "/students/:id",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Lấy chi tiết sinh viên theo ID",
                tags: ["admin-students"],
                security: [{ bearerAuth: [] }],
                params: {
                    type: "object",
                    required: ["id"],
                    properties: {
                        id: {
                            type: "string",
                            description: "ID của sinh viên",
                        },
                    },
                },
                response: {
                    200: {
                        description: "Lấy chi tiết sinh viên thành công",
                        ...StudentResponseJsonSchema,
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
                        description: "Không tìm thấy sinh viên",
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
            const result = await getStudentDetailsUseCase.execute(request.params.id);

            if (result.success) {
                return reply.code(200).send(result.data);
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // PUT /api/v1/admin/students/:id - update student
    app.put<{ Params: { id: string }; Body: UpdateStudentRequestDto }>(
        "/students/:id",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Cập nhật hồ sơ sinh viên",
                tags: ["admin-students"],
                security: [{ bearerAuth: [] }],
                params: {
                    type: "object",
                    required: ["id"],
                    properties: {
                        id: {
                            type: "string",
                            description: "ID của sinh viên",
                        },
                    },
                },
                body: UpdateStudentBodyJsonSchema,
                response: {
                    200: {
                        description: "Cập nhật sinh viên thành công",
                        ...StudentResponseJsonSchema,
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
                        description: "Không tìm thấy sinh viên",
                        ...ErrorResponseJsonSchema,
                    },
                    409: {
                        description: "Mã sinh viên đã tồn tại",
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
            const parseResult = UpdateStudentRequestSchema.safeParse(request.body);

            if (!parseResult.success) {
                const firstError = parseResult.error.issues[0];
                return reply.code(400).send({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: firstError.message,
                    },
                });
            }

            const result = await updateStudentUseCase.execute(request.params.id, parseResult.data);

            if (result.success) {
                return reply.code(200).send(result.data);
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // DELETE /api/v1/admin/students/:id - delete student
    app.delete<{ Params: { id: string } }>(
        "/students/:id",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Xóa hồ sơ sinh viên",
                tags: ["admin-students"],
                security: [{ bearerAuth: [] }],
                params: {
                    type: "object",
                    required: ["id"],
                    properties: {
                        id: {
                            type: "string",
                            description: "ID của sinh viên",
                        },
                    },
                },
                response: {
                    200: {
                        description: "Xóa sinh viên thành công",
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
                        description: "Không tìm thấy sinh viên",
                        ...ErrorResponseJsonSchema,
                    },
                    409: {
                        description: "Không thể xóa sinh viên còn dữ liệu phụ thuộc",
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
            const result = await deleteStudentUseCase.execute(request.params.id);

            if (result.success) {
                return reply.code(200).send({
                    message: "Xóa sinh viên thành công",
                });
            }

            return reply.code(getStatusCodeForError(result.error.code)).send({
                error: result.error,
            });
        },
    );

    // POST /api/v1/admin/students/:id/link-account - link account to student
    app.post<{ Params: { id: string }; Body: LinkAccountRequestDto }>(
        "/students/:id/link-account",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Liên kết tài khoản với sinh viên",
                tags: ["admin-students"],
                security: [{ bearerAuth: [] }],
                params: {
                    type: "object",
                    required: ["id"],
                    properties: {
                        id: {
                            type: "string",
                            description: "ID của sinh viên",
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
                        description: "Không tìm thấy sinh viên hoặc tài khoản",
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

    // DELETE /api/v1/admin/students/:id/unlink-account - unlink account from student
    app.delete<{ Params: { id: string } }>(
        "/students/:id/unlink-account",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Hủy liên kết tài khoản khỏi sinh viên",
                tags: ["admin-students"],
                security: [{ bearerAuth: [] }],
                params: {
                    type: "object",
                    required: ["id"],
                    properties: {
                        id: {
                            type: "string",
                            description: "ID của sinh viên",
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
                        description: "Không tìm thấy sinh viên",
                        ...ErrorResponseJsonSchema,
                    },
                    409: {
                        description: "Sinh viên chưa liên kết tài khoản",
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

    // POST /api/v1/admin/students/import - import students from XLSX/CSV file
    app.post(
        "/students/import",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Nhập danh sách sinh viên từ file XLSX (ưu tiên) hoặc CSV (có thể tạo tài khoản)",
                tags: ["admin-students"],
                security: [{ bearerAuth: [] }],
                consumes: ["multipart/form-data"],
                response: {
                    200: {
                        description: "Kết quả nhập file",
                        type: "object",
                        properties: {
                            total: { type: "number" },
                            created: { type: "number" },
                            skipped: { type: "number" },
                            failed: { type: "number" },
                            errors: { type: "array", items: { type: "object" } },
                            generatedPasswords: { type: "array", items: { type: "object" } },
                        },
                    },
                    400: { ...ErrorResponseJsonSchema },
                    401: { ...ErrorResponseJsonSchema },
                    403: { ...ErrorResponseJsonSchema },
                    500: { ...ErrorResponseJsonSchema },
                },
            },
        },
        async (request, reply) => {
            try {
                const data = await request.file();
                if (!data) {
                    return reply.code(400).send({
                        error: { code: "NO_FILE", message: "Không tìm thấy file" },
                    });
                }

                // Validate MIME type (accept both XLSX and CSV)
                const mimeValidation = FileParser.validateMimeType(data.mimetype);
                if (!mimeValidation.valid) {
                    return reply.code(400).send({
                        error: { 
                            code: "INVALID_FILE_TYPE", 
                            message: "Chỉ chấp nhận file XLSX hoặc CSV" 
                        },
                    });
                }

                const buffer = await data.toBuffer();
                
                // Parse file (auto-detect XLSX or CSV)
                const parsed = FileParser.parseSpreadsheet(buffer, data.mimetype);
                const result = await importStudents.execute(parsed.rows);

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

    // GET /api/v1/admin/students/import/template - download XLSX/CSV template
    app.get(
        "/students/import/template",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Tải file mẫu XLSX (ưu tiên) hoặc CSV để nhập sinh viên",
                tags: ["admin-students"],
                security: [{ bearerAuth: [] }],
                querystring: {
                    type: "object",
                    properties: {
                        format: {
                            type: "string",
                            enum: ["xlsx", "csv"],
                            description: "Định dạng file (mặc định: xlsx)",
                        },
                    },
                },
                response: {
                    200: { description: "File mẫu", type: "string" },
                    401: { ...ErrorResponseJsonSchema },
                    403: { ...ErrorResponseJsonSchema },
                },
            },
        },
        async (request, reply) => {
            const query = request.query as { format?: "xlsx" | "csv" };
            const format = query.format || "xlsx";

            const headers = [
                "STT",
                "Mã sinh viên",
                "Họ và Tên",
                "Lớp",
                "Email",
                "Mật Khẩu",
                "Số điện thoại",
            ];

            const exampleRow = {
                STT: "1",
                "Mã sinh viên": "2251172560",
                "Họ và Tên": "Nguyễn Văn A",
                "Lớp": "62TH1",
                Email: "2251172560@e.tlu.edu.vn",
                "Mật Khẩu": "123456",
                "Số điện thoại": "901234567",
            };

            if (format === "xlsx") {
                const buffer = FileParser.buildXlsxTemplate(headers, exampleRow);
                return reply
                    .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                    .header("Content-Disposition", 'attachment; filename="sinh_vien_mau.xlsx"')
                    .send(buffer);
            } else {
                const csv = FileParser.buildCsvTemplate(headers, exampleRow);
                return reply
                    .header("Content-Type", "text/csv; charset=utf-8")
                    .header("Content-Disposition", 'attachment; filename="sinh_vien_mau.csv"')
                    .send(csv);
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
        case "INVALID_STUDENT_CODE":
        case "INVALID_FULL_NAME":
            return 400;
        case "UNAUTHORIZED":
            return 401;
        case "STUDENT_NOT_FOUND":
        case "CLASS_NOT_FOUND":
        case "ACCOUNT_NOT_FOUND":
            return 404;
        case "DUPLICATE_STUDENT_CODE":
        case "ACCOUNT_ALREADY_LINKED":
        case "ACCOUNT_ROLE_MISMATCH":
        case "STUDENT_NOT_LINKED":
            return 409;
        case "INTERNAL_ERROR":
        default:
            return 500;
    }
}
