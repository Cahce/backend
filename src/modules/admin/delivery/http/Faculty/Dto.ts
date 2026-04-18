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

// Create Faculty Request
export const CreateFacultyRequestSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(1, "Tên khoa là bắt buộc")
            .openapi({
                description: "Tên khoa",
                example: "Khoa Công nghệ Thông tin",
            }),
        code: z
            .string()
            .trim()
            .min(1, "Mã khoa là bắt buộc")
            .openapi({
                description: "Mã khoa (duy nhất)",
                example: "CNTT",
            }),
    })
    .openapi("CreateFacultyRequest");

export type CreateFacultyRequestDto = z.infer<typeof CreateFacultyRequestSchema>;

// Update Faculty Request
export const UpdateFacultyRequestSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(1, "Tên khoa không được để trống")
            .optional()
            .openapi({
                description: "Tên khoa",
                example: "Khoa Công nghệ Thông tin",
            }),
        code: z
            .string()
            .trim()
            .min(1, "Mã khoa không được để trống")
            .optional()
            .openapi({
                description: "Mã khoa (duy nhất)",
                example: "CNTT",
            }),
    })
    .openapi("UpdateFacultyRequest");

export type UpdateFacultyRequestDto = z.infer<typeof UpdateFacultyRequestSchema>;

// List Faculties Query Parameters
export const ListFacultiesQuerySchema = z
    .object({
        search: z
            .string()
            .trim()
            .optional()
            .openapi({
                description: "Tìm kiếm theo tên hoặc mã khoa",
                example: "công nghệ",
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
    .openapi("ListFacultiesQuery");

export type ListFacultiesQueryDto = z.infer<typeof ListFacultiesQuerySchema>;

/**
 * =========================
 * Response DTOs
 * =========================
 */

// Faculty Response
export const FacultyResponseSchema = z
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
        createdAt: z.string().openapi({
            description: "Thời gian tạo (ISO 8601)",
            example: "2024-01-15T10:30:00.000Z",
        }),
        updatedAt: z.string().openapi({
            description: "Thời gian cập nhật (ISO 8601)",
            example: "2024-01-15T10:30:00.000Z",
        }),
    })
    .openapi("FacultyResponse");

export type FacultyResponseDto = z.infer<typeof FacultyResponseSchema>;

// List Faculties Response
export const ListFacultiesResponseSchema = z
    .object({
        items: z.array(FacultyResponseSchema).openapi({
            description: "Danh sách khoa, sắp xếp theo updatedAt giảm dần",
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
    .openapi("ListFacultiesResponse");

export type ListFacultiesResponseDto = z.infer<typeof ListFacultiesResponseSchema>;

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
                example: "Mã khoa đã tồn tại",
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
            example: "Xóa khoa thành công",
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

export const CreateFacultyBodyJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(CreateFacultyRequestSchema as any, "CreateFacultyRequest"),
);

export const UpdateFacultyBodyJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(UpdateFacultyRequestSchema as any, "UpdateFacultyRequest"),
);

export const ListFacultiesQueryJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(ListFacultiesQuerySchema as any, "ListFacultiesQuery"),
);

export const FacultyResponseJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(FacultyResponseSchema as any, "FacultyResponse"),
);

export const ListFacultiesResponseJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(ListFacultiesResponseSchema as any, "ListFacultiesResponse"),
);

export const ErrorResponseJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(ErrorResponseSchema as any, "ErrorResponse"),
);

export const MessageResponseJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(MessageResponseSchema as any, "MessageResponse"),
);
