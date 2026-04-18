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

// Create Major Request
export const CreateMajorRequestSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(1, "Tên ngành là bắt buộc")
            .openapi({
                description: "Tên ngành",
                example: "Công nghệ Thông tin",
            }),
        code: z
            .string()
            .trim()
            .min(1, "Mã ngành là bắt buộc")
            .openapi({
                description: "Mã ngành (duy nhất)",
                example: "CNTT",
            }),
        facultyId: z
            .string()
            .min(1, "ID khoa là bắt buộc")
            .openapi({
                description: "ID khoa (ngành thuộc khoa)",
                example: "cmnztabnn0000e8vmyzb8gqtn",
            }),
    })
    .openapi("CreateMajorRequest");

export type CreateMajorRequestDto = z.infer<typeof CreateMajorRequestSchema>;

// Update Major Request
export const UpdateMajorRequestSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(1, "Tên ngành không được để trống")
            .optional()
            .openapi({
                description: "Tên ngành",
                example: "Công nghệ Thông tin",
            }),
        code: z
            .string()
            .trim()
            .min(1, "Mã ngành không được để trống")
            .optional()
            .openapi({
                description: "Mã ngành (duy nhất)",
                example: "CNTT",
            }),
        facultyId: z
            .string()
            .min(1, "ID khoa không được để trống")
            .optional()
            .openapi({
                description: "ID khoa",
                example: "cmnztabnn0000e8vmyzb8gqtn",
            }),
    })
    .openapi("UpdateMajorRequest");

export type UpdateMajorRequestDto = z.infer<typeof UpdateMajorRequestSchema>;

// List Majors Query Parameters
export const ListMajorsQuerySchema = z
    .object({
        search: z
            .string()
            .trim()
            .optional()
            .openapi({
                description: "Tìm kiếm theo tên hoặc mã ngành",
                example: "công nghệ",
            }),
        facultyId: z
            .string()
            .optional()
            .openapi({
                description: "Lọc theo ID khoa",
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
    .openapi("ListMajorsQuery");

export type ListMajorsQueryDto = z.infer<typeof ListMajorsQuerySchema>;

/**
 * =========================
 * Response DTOs
 * =========================
 */

// Faculty Context (for Major response)
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

// Major Response
export const MajorResponseSchema = z
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
        facultyId: z.string().openapi({
            description: "ID khoa",
            example: "cmnztabnn0000e8vmyzb8gqtn",
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
    .openapi("MajorResponse");

export type MajorResponseDto = z.infer<typeof MajorResponseSchema>;

// List Majors Response
export const ListMajorsResponseSchema = z
    .object({
        items: z.array(MajorResponseSchema).openapi({
            description: "Danh sách ngành, sắp xếp theo updatedAt giảm dần",
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
    .openapi("ListMajorsResponse");

export type ListMajorsResponseDto = z.infer<typeof ListMajorsResponseSchema>;

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
                example: "Mã ngành đã tồn tại",
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
            example: "Xóa ngành thành công",
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

export const CreateMajorBodyJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(CreateMajorRequestSchema as any, "CreateMajorRequest"),
);

export const UpdateMajorBodyJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(UpdateMajorRequestSchema as any, "UpdateMajorRequest"),
);

export const ListMajorsQueryJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(ListMajorsQuerySchema as any, "ListMajorsQuery"),
);

export const MajorResponseJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(MajorResponseSchema as any, "MajorResponse"),
);

export const ListMajorsResponseJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(ListMajorsResponseSchema as any, "ListMajorsResponse"),
);

export const ErrorResponseJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(ErrorResponseSchema as any, "ErrorResponse"),
);

export const MessageResponseJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(MessageResponseSchema as any, "MessageResponse"),
);
