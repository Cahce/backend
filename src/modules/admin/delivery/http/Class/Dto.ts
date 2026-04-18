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

// Create Class Request
export const CreateClassRequestSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(1, "Tên lớp là bắt buộc")
            .openapi({
                description: "Tên lớp",
                example: "CNTT K18",
            }),
        code: z
            .string()
            .trim()
            .min(1, "Mã lớp là bắt buộc")
            .openapi({
                description: "Mã lớp (duy nhất)",
                example: "CNTT18",
            }),
        majorId: z
            .string()
            .min(1, "ID ngành là bắt buộc")
            .openapi({
                description: "ID ngành (lớp thuộc ngành)",
                example: "cmnztabnn0000e8vmyzb8gqtn",
            }),
    })
    .openapi("CreateClassRequest");

export type CreateClassRequestDto = z.infer<typeof CreateClassRequestSchema>;

// Update Class Request
export const UpdateClassRequestSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(1, "Tên lớp không được để trống")
            .optional()
            .openapi({
                description: "Tên lớp",
                example: "CNTT K18",
            }),
        code: z
            .string()
            .trim()
            .min(1, "Mã lớp không được để trống")
            .optional()
            .openapi({
                description: "Mã lớp (duy nhất)",
                example: "CNTT18",
            }),
        majorId: z
            .string()
            .min(1, "ID ngành không được để trống")
            .optional()
            .openapi({
                description: "ID ngành",
                example: "cmnztabnn0000e8vmyzb8gqtn",
            }),
    })
    .openapi("UpdateClassRequest");

export type UpdateClassRequestDto = z.infer<typeof UpdateClassRequestSchema>;

// List Classes Query Parameters
export const ListClassesQuerySchema = z
    .object({
        search: z
            .string()
            .trim()
            .optional()
            .openapi({
                description: "Tìm kiếm theo tên hoặc mã lớp",
                example: "CNTT",
            }),
        majorId: z
            .string()
            .optional()
            .openapi({
                description: "Lọc theo ID ngành",
                example: "cmnztabnn0000e8vmyzb8gqtn",
            }),
        facultyId: z
            .string()
            .optional()
            .openapi({
                description: "Lọc theo ID khoa (qua ngành)",
                example: "cmnztabnn0000e8vmyzb8gqtn",
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
    .openapi("ListClassesQuery");

export type ListClassesQueryDto = z.infer<typeof ListClassesQuerySchema>;

/**
 * =========================
 * Response DTOs
 * =========================
 */

// Major Context (for Class response)
export const MajorContextSchema = z
    .object({
        id: z.string().openapi({
            description: "ID ngành",
            example: "cmnztabnn0000e8vmyzb8gqtn",
        }),
        name: z.string().openapi({
            description: "Tên ngành",
            example: "Công nghệ Thông tin",
        }),
        code: z.string().openapi({
            description: "Mã ngành",
            example: "CNTT",
        }),
    })
    .openapi("MajorContext");

export type MajorContextDto = z.infer<typeof MajorContextSchema>;

// Faculty Context (for Class response)
export const FacultyContextSchema = z
    .object({
        id: z.string().openapi({
            description: "ID khoa",
            example: "cmnztabnn0000e8vmyzb8gqtn",
        }),
        name: z.string().openapi({
            description: "Tên khoa",
            example: "Khoa Công nghệ Thông tin",
        }),
        code: z.string().openapi({
            description: "Mã khoa",
            example: "CNTT",
        }),
    })
    .openapi("FacultyContext");

export type FacultyContextDto = z.infer<typeof FacultyContextSchema>;

// Class Response
export const ClassResponseSchema = z
    .object({
        id: z.string().openapi({
            description: "ID lớp",
            example: "cmnztabnn0000e8vmyzb8gqtn",
        }),
        name: z.string().openapi({
            description: "Tên lớp",
            example: "CNTT K18",
        }),
        code: z.string().openapi({
            description: "Mã lớp",
            example: "CNTT18",
        }),
        majorId: z.string().openapi({
            description: "ID ngành",
            example: "cmnztabnn0000e8vmyzb8gqtn",
        }),
        major: MajorContextSchema.optional().openapi({
            description: "Thông tin ngành (nếu có)",
        }),
        faculty: FacultyContextSchema.optional().openapi({
            description: "Thông tin khoa (nếu có)",
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
    .openapi("ClassResponse");

export type ClassResponseDto = z.infer<typeof ClassResponseSchema>;

// List Classes Response
export const ListClassesResponseSchema = z
    .object({
        items: z.array(ClassResponseSchema).openapi({
            description: "Danh sách lớp, sắp xếp theo updatedAt giảm dần",
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
    .openapi("ListClassesResponse");

export type ListClassesResponseDto = z.infer<typeof ListClassesResponseSchema>;

// Error Response
export const ErrorResponseSchema = z
    .object({
        error: z.object({
            code: z.string().openapi({
                description: "Mã lỗi",
                example: "DUPLICATE_CODE",
            }),
            message: z.string().openapi({
                description: "Thông báo lỗi",
                example: "Mã lớp đã tồn tại",
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
            example: "Xóa lớp thành công",
        }),
    })
    .openapi("MessageResponse");

export type MessageResponseDto = z.infer<typeof MessageResponseSchema>;

/**
 * =========================
 * Fastify JSON Schemas
 * =========================
 * Dùng cho schema.body / schema.querystring / schema.response
 * Không nhét raw Zod schema trực tiếp vào Fastify.
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

export const CreateClassBodyJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(CreateClassRequestSchema as any, "CreateClassRequest"),
);

export const UpdateClassBodyJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(UpdateClassRequestSchema as any, "UpdateClassRequest"),
);

export const ListClassesQueryJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(ListClassesQuerySchema as any, "ListClassesQuery"),
);

export const ClassResponseJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(ClassResponseSchema as any, "ClassResponse"),
);

export const ListClassesResponseJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(ListClassesResponseSchema as any, "ListClassesResponse"),
);

export const ErrorResponseJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(ErrorResponseSchema as any, "ErrorResponse"),
);

export const MessageResponseJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(MessageResponseSchema as any, "MessageResponse"),
);
