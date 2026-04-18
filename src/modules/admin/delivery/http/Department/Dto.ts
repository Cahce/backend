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

// Create Department Request
export const CreateDepartmentRequestSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(1, "Tên bộ môn là bắt buộc")
            .openapi({
                description: "Tên bộ môn",
                example: "Bộ môn Công nghệ Phần mềm",
            }),
        code: z
            .string()
            .trim()
            .min(1, "Mã bộ môn là bắt buộc")
            .openapi({
                description: "Mã bộ môn (duy nhất)",
                example: "CNPM",
            }),
        facultyId: z
            .string()
            .min(1, "ID khoa là bắt buộc")
            .openapi({
                description: "ID khoa (bộ môn thuộc khoa)",
                example: "cmnztabnn0000e8vmyzb8gqtn",
            }),
    })
    .openapi("CreateDepartmentRequest");

export type CreateDepartmentRequestDto = z.infer<typeof CreateDepartmentRequestSchema>;

// Update Department Request
export const UpdateDepartmentRequestSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(1, "Tên bộ môn không được để trống")
            .optional()
            .openapi({
                description: "Tên bộ môn",
                example: "Bộ môn Công nghệ Phần mềm",
            }),
        code: z
            .string()
            .trim()
            .min(1, "Mã bộ môn không được để trống")
            .optional()
            .openapi({
                description: "Mã bộ môn (duy nhất)",
                example: "CNPM",
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
    .openapi("UpdateDepartmentRequest");

export type UpdateDepartmentRequestDto = z.infer<typeof UpdateDepartmentRequestSchema>;

// List Departments Query Parameters
export const ListDepartmentsQuerySchema = z
    .object({
        search: z
            .string()
            .trim()
            .optional()
            .openapi({
                description: "Tìm kiếm theo tên hoặc mã bộ môn",
                example: "phần mềm",
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
    .openapi("ListDepartmentsQuery");

export type ListDepartmentsQueryDto = z.infer<typeof ListDepartmentsQuerySchema>;

/**
 * =========================
 * Response DTOs
 * =========================
 */

// Faculty Context (for Department response)
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

// Department Response
export const DepartmentResponseSchema = z
    .object({
        id: z.string().openapi({
            description: "ID bộ môn",
            example: "cmnztabnn0000e8vmyzb8gqtn",
        }),
        name: z.string().openapi({
            description: "Tên bộ môn",
            example: "Bộ môn Công nghệ Phần mềm",
        }),
        code: z.string().openapi({
            description: "Mã bộ môn",
            example: "CNPM",
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
    .openapi("DepartmentResponse");

export type DepartmentResponseDto = z.infer<typeof DepartmentResponseSchema>;

// List Departments Response
export const ListDepartmentsResponseSchema = z
    .object({
        items: z.array(DepartmentResponseSchema).openapi({
            description: "Danh sách bộ môn, sắp xếp theo updatedAt giảm dần",
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
    .openapi("ListDepartmentsResponse");

export type ListDepartmentsResponseDto = z.infer<typeof ListDepartmentsResponseSchema>;

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
                example: "Mã bộ môn đã tồn tại",
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
            example: "Xóa bộ môn thành công",
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

export const CreateDepartmentBodyJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(CreateDepartmentRequestSchema as any, "CreateDepartmentRequest"),
);

export const UpdateDepartmentBodyJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(UpdateDepartmentRequestSchema as any, "UpdateDepartmentRequest"),
);

export const ListDepartmentsQueryJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(ListDepartmentsQuerySchema as any, "ListDepartmentsQuery"),
);

export const DepartmentResponseJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(DepartmentResponseSchema as any, "DepartmentResponse"),
);

export const ListDepartmentsResponseJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(ListDepartmentsResponseSchema as any, "ListDepartmentsResponse"),
);

export const ErrorResponseJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(ErrorResponseSchema as any, "ErrorResponse"),
);

export const MessageResponseJsonSchema = unwrapJsonSchema(
    zodToJsonSchema(MessageResponseSchema as any, "MessageResponse"),
);
