import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Extend Zod with OpenAPI support
extendZodWithOpenApi(z);

/**
 * =========================
 * Request DTOs
 * =========================
 */

// Template Category Schema
export const TemplateCategorySchema = z.enum([
  'thesis',
  'report',
  'proposal',
  'paper',
  'presentation',
  'other',
]);

// Create Project Request
export const CreateProjectRequestSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Tiêu đề dự án là bắt buộc')
      .openapi({
        description: 'Tiêu đề dự án',
        example: 'Luận văn tốt nghiệp',
      }),
    category: TemplateCategorySchema.openapi({
      description: 'Danh mục dự án',
      example: 'thesis',
    }),
  })
  .openapi('CreateProjectRequest');

export type CreateProjectRequestDto = z.infer<typeof CreateProjectRequestSchema>;

// Update Project Request
export const UpdateProjectRequestSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Tiêu đề dự án không được để trống')
      .optional()
      .openapi({
        description: 'Tiêu đề dự án',
        example: 'Luận văn tốt nghiệp (cập nhật)',
      }),
    category: TemplateCategorySchema.optional().openapi({
      description: 'Danh mục dự án',
      example: 'thesis',
    }),
  })
  .openapi('UpdateProjectRequest');

export type UpdateProjectRequestDto = z.infer<typeof UpdateProjectRequestSchema>;

/**
 * =========================
 * Response DTOs
 * =========================
 */

// Project Response
export const ProjectResponseSchema = z
  .object({
    id: z.string().openapi({
      description: 'ID dự án',
      example: 'cmnztabnn0000e8vmyzb8gqtn',
    }),
    title: z.string().openapi({
      description: 'Tiêu đề dự án',
      example: 'Luận văn tốt nghiệp',
    }),
    category: TemplateCategorySchema.openapi({
      description: 'Danh mục dự án',
      example: 'thesis',
    }),
    ownerId: z.string().nullable().openapi({
      description: 'ID chủ sở hữu',
      example: 'user123',
    }),
    createdAt: z.string().openapi({
      description: 'Thời gian tạo (ISO 8601)',
      example: '2024-01-15T10:30:00.000Z',
    }),
    updatedAt: z.string().openapi({
      description: 'Thời gian cập nhật (ISO 8601)',
      example: '2024-01-15T10:30:00.000Z',
    }),
    lastEditedAt: z.string().nullable().openapi({
      description: 'Thời gian chỉnh sửa cuối (ISO 8601)',
      example: '2024-01-15T10:30:00.000Z',
    }),
  })
  .openapi('ProjectResponse');

export type ProjectResponseDto = z.infer<typeof ProjectResponseSchema>;

// Project List Response
export const ProjectListResponseSchema = z
  .object({
    projects: z.array(ProjectResponseSchema).openapi({
      description: 'Danh sách dự án, sắp xếp theo updatedAt giảm dần',
    }),
  })
  .openapi('ProjectListResponse');

export type ProjectListResponseDto = z.infer<typeof ProjectListResponseSchema>;

// Error Response
export const ErrorResponseSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({
        description: 'Mã lỗi',
        example: 'PROJECT_NOT_FOUND',
      }),
      message: z.string().openapi({
        description: 'Thông báo lỗi',
        example: 'Không tìm thấy dự án',
      }),
    }),
  })
  .openapi('ErrorResponse');

export type ErrorResponseDto = z.infer<typeof ErrorResponseSchema>;

// Message Response
export const MessageResponseSchema = z
  .object({
    message: z.string().openapi({
      description: 'Thông báo kết quả',
      example: 'Xóa dự án thành công',
    }),
  })
  .openapi('MessageResponse');

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
  if ('$ref' in s && 'definitions' in s) {
    const refName = (s.$ref as string).replace('#/definitions/', '');
    const defs = s.definitions as Record<string, unknown>;
    return defs[refName] as Record<string, unknown>;
  }
  const { $schema, ...rest } = s;
  return rest;
}

export const CreateProjectBodyJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(CreateProjectRequestSchema as any, 'CreateProjectRequest'),
);

export const UpdateProjectBodyJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(UpdateProjectRequestSchema as any, 'UpdateProjectRequest'),
);

export const ProjectResponseJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ProjectResponseSchema as any, 'ProjectResponse'),
);

export const ProjectListResponseJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ProjectListResponseSchema as any, 'ProjectListResponse'),
);

export const ErrorResponseJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ErrorResponseSchema as any, 'ErrorResponse'),
);

export const MessageResponseJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(MessageResponseSchema as any, 'MessageResponse'),
);
