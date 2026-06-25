import type { FastifyInstance } from "fastify";
import { AdminContainer } from "../../../Container.js";
import { FileParser } from "../../../infra/FileParser.js";
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
    const container = new AdminContainer(app.prisma);
    const createTeacherUseCase = container.createTeacherProfileUseCase;
    const listTeachersUseCase = container.listTeacherProfilesUseCase;
    const getTeacherDetailsUseCase = container.getTeacherProfileDetailsUseCase;
    const updateTeacherUseCase = container.updateTeacherProfileUseCase;
    const deleteTeacherUseCase = container.deleteTeacherProfileUseCase;
    const linkAccountUseCase = container.linkAccountToTeacherUseCase;
    const unlinkAccountUseCase = container.unlinkAccountFromTeacherUseCase;
    const importTeachers = container.importTeachers;

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

    // POST /api/v1/admin/teachers/import - import teachers from XLSX/CSV file
    app.post(
        "/teachers/import",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Nhập danh sách giảng viên từ file XLSX (ưu tiên) hoặc CSV (có thể tạo tài khoản)",
                tags: ["admin-teachers"],
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
                const result = await importTeachers.execute(parsed.rows);

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

    // GET /api/v1/admin/teachers/import/template - download XLSX/CSV template
    app.get(
        "/teachers/import/template",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Tải file mẫu XLSX (ưu tiên) hoặc CSV để nhập giảng viên",
                tags: ["admin-teachers"],
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

            // No "Mã GV" column on purpose — matches "Mẫu Import Giảng viên.xlsx".
            // ImportTeachers auto-generates teacherCode from the dominant DB pattern.
            const headers = [
                "STT",
                "Họ và Tên",
                "Học hàm",
                "Học vị",
                "Bộ Môn",
                "Email",
                "Mật Khẩu",
                "Số điện thoại",
            ];

            const exampleRow = {
                STT: "1",
                "Họ và Tên": "Kiều Tuấn Dũng",
                "Học hàm": "Không",
                "Học vị": "Thạc sĩ",
                "Bộ Môn": "KTPM",
                Email: "kieutuandung@tlu.edu.vn",
                "Mật Khẩu": "123456",
                "Số điện thoại": "987654321",
            };

            if (format === "xlsx") {
                const buffer = FileParser.buildXlsxTemplate(headers, exampleRow);
                return reply
                    .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                    .header("Content-Disposition", 'attachment; filename="giang_vien_mau.xlsx"')
                    .send(buffer);
            } else {
                const csv = FileParser.buildCsvTemplate(headers, exampleRow);
                return reply
                    .header("Content-Type", "text/csv; charset=utf-8")
                    .header("Content-Disposition", 'attachment; filename="giang_vien_mau.csv"')
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
