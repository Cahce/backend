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

// Create Teacher Request
export const CreateTeacherRequestSchema = z
    .object({
        teacherCode: z
            .string()
            .trim()
            .min(1, "Mã giảng viên là bắt buộc")
            .openapi({
                description: "Mã giảng viên (duy nhất)",
                example: "GV001",
            }),
        fullName: z
            .string()
            .trim()
            .min(1, "Họ tên là bắt buộc")
            .openapi({
                description: "Họ và tên giảng viên",
                example: "Nguyễn Văn A",
            }),
        departmentId: z
            .string()
            .trim()
            .min(1, "ID bộ môn là bắt buộc")
            .openapi({
                description: "ID bộ môn",
                example: "cmnztabnn0000e8vmyzb8gqtn",
            }),
        academicRank: z
            .string()
            .trim()
            .min(1, "Học hàm là bắt buộc")
            .openapi({
                description: "Học hàm (Giáo sư, Phó Giáo sư, Tiến sĩ, Thạc sĩ, Cử nhân)",
                example: "Tiến sĩ",
            }),
        academicDegree: z
            .string()
            .trim()
            .min(1, "Học vị là bắt buộc")
            .openapi({
                description: "Học vị (Giáo sư, Phó Giáo sư, Tiến sĩ, Thạc sĩ, Cử nhân)",
                example: "Tiến sĩ",
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
    .openapi("CreateTeacherRequest");

export type CreateTeacherRequestDto = z.infer<typeof CreateTeacherRequestSchema>;

// Update Teacher Request
export const UpdateTeacherRequestSchema = z
    .object({
        teacherCode: z
            .string()
            .trim()
            .min(1, "Mã giảng viên không được để trống")
            .optional()
            .openapi({
                description: "Mã giảng viên (duy nhất)",
                example: "GV001",
            }),
        fullName: z
            .string()
            .trim()
            .min(1, "Họ tên không được để trống")
            .optional()
            .openapi({
                description: "Họ và tên giảng viên",
                example: "Nguyễn Văn A",
            }),
        departmentId: z
            .string()
            .trim()
            .min(1, "ID bộ môn không được để trống")
            .optional()
            .openapi({
                description: "ID bộ môn",
                example: "cmnztabnn0000e8vmyzb8gqtn",
            }),
        academicRank: z
            .string()
            .trim()
            .min(1, "Học hàm không được để trống")
            .optional()
            .openapi({
                description: "Học hàm",
                example: "Tiến sĩ",
            }),
        academicDegree: z
            .string()
            .trim()
            .min(1, "Học vị không được để trống")
            .optional()
            .openapi({
                description: "Học vị",
                example: "Tiến sĩ",
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
    .openapi("UpdateTeacherRequest");

export type UpdateTeacherRequestDto = z.infer<typeof UpdateTeacherRequestSchema>;

// List Teachers Query Parameters
export const ListTeachersQuerySchema = z
    .object({
        search: z
            .string()
            .trim()
            .optional()
            .openapi({
                description: "Tìm kiếm theo họ tên hoặc mã giảng viên",
                example: "Nguyễn",
            }),
        departmentId: z
            .string()
            .trim()
            .optional()
            .openapi({
                description: "Lọc theo ID bộ môn",
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
    .openapi("ListTeachersQuery");

export type ListTeachersQueryDto = z.infer<typeof ListTeachersQuerySchema>;

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

// Teacher Response
export const TeacherResponseSchema = z
    .object({
        id: z.string().openapi({
            description: "ID giảng viên",
            example: "cmnztabnn0000e8vmyzb8gqtn",
        }),
        accountId: z.string().nullable().openapi({
            description: "ID tài khoản liên kết",
            example: "cmnztabnn0000e8vmyzb8gqtn",
        }),
        teacherCode: z.string().openapi({
            description: "Mã giảng viên",
            example: "GV001",
        }),
        fullName: z.string().openapi({
            description: "Họ và tên",
            example: "Nguyễn Văn A",
        }),
        departmentId: z.string().openapi({
            description: "ID bộ môn",
            example: "cmnztabnn0000e8vmyzb8gqtn",
        }),
        academicRank: z.string().openapi({
            description: "Học hàm",
            example: "Tiến sĩ",
        }),
        academicDegree: z.string().openapi({
            description: "Học vị",
            example: "Tiến sĩ",
        }),
        phone: z.string().nullable().openapi({
            description: "Số điện thoại",
            example: "0912345678",
        }),
        department: z.object({
            id: z.string(),
            name: z.string(),
            code: z.string(),
            facultyId: z.string(),
        }).optional().openapi({
            description: "Thông tin bộ môn",
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
    .openapi("TeacherResponse");

export type TeacherResponseDto = z.infer<typeof TeacherResponseSchema>;

// List Teachers Response
export const ListTeachersResponseSchema = z
    .object({
        items: z.array(TeacherResponseSchema).openapi({
            description: "Danh sách giảng viên, sắp xếp theo updatedAt giảm dần",
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
    .openapi("ListTeachersResponse");

export type ListTeachersResponseDto = z.infer<typeof ListTeachersResponseSchema>;

// Error Response
export const ErrorResponseSchema = z
    .object({
        error: z.object({
            code: z.string().openapi({
                description: "Mã lỗi",
                example: "DUPLICATE_TEACHER_CODE",
            }),
            message: z.string().openapi({
                description: "Thông báo lỗi",
                example: "Mã giảng viên đã tồn tại",
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
            example: "Xóa giảng viên thành công",
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

export const CreateTeacherBodyJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(CreateTeacherRequestSchema as any, "CreateTeacherRequest"),
);

export const UpdateTeacherBodyJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(UpdateTeacherRequestSchema as any, "UpdateTeacherRequest"),
);

export const ListTeachersQueryJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(ListTeachersQuerySchema as any, "ListTeachersQuery"),
);

export const LinkAccountBodyJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(LinkAccountRequestSchema as any, "LinkAccountRequest"),
);

export const TeacherResponseJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(TeacherResponseSchema as any, "TeacherResponse"),
);

export const ListTeachersResponseJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(ListTeachersResponseSchema as any, "ListTeachersResponse"),
);

export const ErrorResponseJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(ErrorResponseSchema as any, "ErrorResponse"),
);

export const MessageResponseJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(MessageResponseSchema as any, "MessageResponse"),
);
