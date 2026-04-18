import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Extend Zod with OpenAPI support
extendZodWithOpenApi(z);

/**
 * =========================
 * Request DTOs
 * =========================
 */

// Create Student Request
export const CreateStudentRequestSchema = z
    .object({
        studentCode: z
            .string()
            .trim()
            .min(1, "Mã sinh viên là bắt buộc")
            .openapi({
                description: "Mã sinh viên (duy nhất)",
                example: "SV001",
            }),
        fullName: z
            .string()
            .trim()
            .min(1, "Họ tên là bắt buộc")
            .openapi({
                description: "Họ và tên sinh viên",
                example: "Nguyễn Văn B",
            }),
        classId: z
            .string()
            .trim()
            .min(1, "ID lớp là bắt buộc")
            .openapi({
                description: "ID lớp",
                example: "cmnztabnn0000e8vmyzb8gqtn",
            }),
        phone: z
            .string()
            .trim()
            .optional()
            .openapi({
                description: "Số điện thoại",
                example: "0912345678",
            }),
        accountId: z
            .string()
            .trim()
            .optional()
            .openapi({
                description: "ID tài khoản liên kết (nếu có)",
                example: "cmnztabnn0000e8vmyzb8gqtn",
            }),
    })
    .openapi("CreateStudentRequest");

export type CreateStudentRequestDto = z.infer<typeof CreateStudentRequestSchema>;

// Update Student Request
export const UpdateStudentRequestSchema = z
    .object({
        studentCode: z
            .string()
            .trim()
            .min(1, "Mã sinh viên không được để trống")
            .optional()
            .openapi({
                description: "Mã sinh viên (duy nhất)",
                example: "SV001",
            }),
        fullName: z
            .string()
            .trim()
            .min(1, "Họ tên không được để trống")
            .optional()
            .openapi({
                description: "Họ và tên sinh viên",
                example: "Nguyễn Văn B",
            }),
        classId: z
            .string()
            .trim()
            .min(1, "ID lớp không được để trống")
            .optional()
            .openapi({
                description: "ID lớp",
                example: "cmnztabnn0000e8vmyzb8gqtn",
            }),
        phone: z
            .string()
            .trim()
            .optional()
            .openapi({
                description: "Số điện thoại",
                example: "0912345678",
            }),
    })
    .openapi("UpdateStudentRequest");

export type UpdateStudentRequestDto = z.infer<typeof UpdateStudentRequestSchema>;

// List Students Query Parameters
export const ListStudentsQuerySchema = z
    .object({
        search: z
            .string()
            .trim()
            .optional()
            .openapi({
                description: "Tìm kiếm theo họ tên hoặc mã sinh viên",
                example: "Nguyễn",
            }),
        classId: z
            .string()
            .trim()
            .optional()
            .openapi({
                description: "Lọc theo ID lớp",
                example: "cmnztabnn0000e8vmyzb8gqtn",
            }),
        majorId: z
            .string()
            .trim()
            .optional()
            .openapi({
                description: "Lọc theo ID ngành",
                example: "cmnztabnn0000e8vmyzb8gqtn",
            }),
        facultyId: z
            .string()
            .trim()
            .optional()
            .openapi({
                description: "Lọc theo ID khoa",
                example: "cmnztabnn0000e8vmyzb8gqtn",
            }),
        hasAccount: z
            .enum(["true", "false"])
            .optional()
            .transform((val) => (val === "true" ? true : val === "false" ? false : undefined))
            .openapi({
                description: "Lọc theo trạng thái liên kết tài khoản",
                example: "true",
            }),
        page: z.coerce
            .number()
            .int()
            .min(1, "Số trang phải lớn hơn hoặc bằng 1")
            .default(1)
            .openapi({
                description: "Số trang",
                example: 1,
            }),
        pageSize: z.coerce
            .number()
            .int()
            .min(1, "Kích thước trang phải lớn hơn hoặc bằng 1")
            .max(100, "Kích thước trang tối đa là 100")
            .default(20)
            .openapi({
                description: "Số lượng bản ghi mỗi trang",
                example: 20,
            }),
    })
    .openapi("ListStudentsQuery");

export type ListStudentsQueryDto = z.infer<typeof ListStudentsQuerySchema>;

// Link Account Request
export const LinkAccountRequestSchema = z
    .object({
        accountId: z
            .string()
            .trim()
            .min(1, "ID tài khoản là bắt buộc")
            .openapi({
                description: "ID tài khoản cần liên kết",
                example: "cmnztabnn0000e8vmyzb8gqtn",
            }),
    })
    .openapi("LinkAccountRequest");

export type LinkAccountRequestDto = z.infer<typeof LinkAccountRequestSchema>;

/**
 * =========================
 * Response DTOs
 * =========================
 */

// Student Response
export const StudentResponseSchema = z
    .object({
        id: z.string().openapi({
            description: "ID sinh viên",
            example: "cmnztabnn0000e8vmyzb8gqtn",
        }),
        accountId: z.string().nullable().openapi({
            description: "ID tài khoản liên kết",
            example: "cmnztabnn0000e8vmyzb8gqtn",
        }),
        studentCode: z.string().openapi({
            description: "Mã sinh viên",
            example: "SV001",
        }),
        fullName: z.string().openapi({
            description: "Họ và tên",
            example: "Nguyễn Văn B",
        }),
        classId: z.string().openapi({
            description: "ID lớp",
            example: "cmnztabnn0000e8vmyzb8gqtn",
        }),
        phone: z.string().nullable().openapi({
            description: "Số điện thoại",
            example: "0912345678",
        }),
        class: z.object({
            id: z.string(),
            name: z.string(),
            code: z.string(),
            majorId: z.string(),
        }).optional().openapi({
            description: "Thông tin lớp",
        }),
        major: z.object({
            id: z.string(),
            name: z.string(),
            code: z.string(),
            facultyId: z.string(),
        }).optional().openapi({
            description: "Thông tin ngành",
        }),
        faculty: z.object({
            id: z.string(),
            name: z.string(),
            code: z.string(),
        }).optional().openapi({
            description: "Thông tin khoa",
        }),
        account: z.object({
            id: z.string(),
            email: z.string(),
            role: z.string(),
            isActive: z.boolean(),
        }).optional().openapi({
            description: "Thông tin tài khoản liên kết",
        }),
        createdAt: z.string().openapi({
            description: "Thời gian tạo (ISO 8601)",
            example: "2024-01-15T10:30:00.000Z",
        }),
        updatedAt: z.string().openapi({
            description: "Thời gian cập nhật (ISO 8601)",
            example: "2024-01-15T10:30:00.000Z",
        }),
    })
    .openapi("StudentResponse");

export type StudentResponseDto = z.infer<typeof StudentResponseSchema>;

// List Students Response
export const ListStudentsResponseSchema = z
    .object({
        items: z.array(StudentResponseSchema).openapi({
            description: "Danh sách sinh viên, sắp xếp theo updatedAt giảm dần",
        }),
        total: z.number().openapi({
            description: "Tổng số bản ghi",
            example: 50,
        }),
        page: z.number().openapi({
            description: "Trang hiện tại",
            example: 1,
        }),
        pageSize: z.number().openapi({
            description: "Số lượng bản ghi mỗi trang",
            example: 20,
        }),
        totalPages: z.number().openapi({
            description: "Tổng số trang",
            example: 3,
        }),
    })
    .openapi("ListStudentsResponse");

export type ListStudentsResponseDto = z.infer<typeof ListStudentsResponseSchema>;

// Error Response
export const ErrorResponseSchema = z
    .object({
        error: z.object({
            code: z.string().openapi({
                description: "Mã lỗi",
                example: "DUPLICATE_STUDENT_CODE",
            }),
            message: z.string().openapi({
                description: "Thông báo lỗi",
                example: "Mã sinh viên đã tồn tại",
            }),
        }),
    })
    .openapi("ErrorResponse");

export type ErrorResponseDto = z.infer<typeof ErrorResponseSchema>;

// Message Response
export const MessageResponseSchema = z
    .object({
        message: z.string().openapi({
            description: "Thông báo kết quả",
            example: "Xóa sinh viên thành công",
        }),
    })
    .openapi("MessageResponse");

export type MessageResponseDto = z.infer<typeof MessageResponseSchema>;

/**
 * =========================
 * Fastify JSON Schemas
 * =========================
 */

function unwrapJsonSchema(schema: unknown): Record<string, unknown> {
    const s = schema as Record<string, unknown>;
    if ("$ref" in s && "definitions" in s) {
        const refName = (s.$ref as string).replace("#/definitions/", "");
        const defs = s.definitions as Record<string, unknown>;
        return defs[refName] as Record<string, unknown>;
    }
    const { $schema, ...rest } = s;
    return rest;
}

export const CreateStudentBodyJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(CreateStudentRequestSchema as any, "CreateStudentRequest"),
);

export const UpdateStudentBodyJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(UpdateStudentRequestSchema as any, "UpdateStudentRequest"),
);

export const ListStudentsQueryJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(ListStudentsQuerySchema as any, "ListStudentsQuery"),
);

export const LinkAccountBodyJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(LinkAccountRequestSchema as any, "LinkAccountRequest"),
);

export const StudentResponseJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(StudentResponseSchema as any, "StudentResponse"),
);

export const ListStudentsResponseJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(ListStudentsResponseSchema as any, "ListStudentsResponse"),
);

export const ErrorResponseJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(ErrorResponseSchema as any, "ErrorResponse"),
);

export const MessageResponseJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(MessageResponseSchema as any, "MessageResponse"),
);
