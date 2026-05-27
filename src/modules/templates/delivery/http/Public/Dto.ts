import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Extend Zod with OpenAPI support
extendZodWithOpenApi(z);

/**
 * =========================
 * Response DTOs
 * =========================
 */

// Public Template Response (with latest version)
export const PublicTemplateResponseSchema = z
  .object({
    id: z.string().openapi({
      description: 'ID mẫu',
      example: 'cmnztabnn0000e8vmyzb8gqtn',
    }),
    name: z.string().openapi({
      description: 'Tên mẫu',
      example: 'Khóa luận tốt nghiệp K2024',
    }),
    description: z.string().nullable().openapi({
      description: 'Mô tả mẫu',
      example: 'Mẫu khóa luận tốt nghiệp cho sinh viên khóa 2024',
    }),
    category: z.string().openapi({
      description: 'Danh mục',
      example: 'thesis',
    }),
    isOfficial: z.boolean().openapi({
      description: 'Mẫu chính thức',
      example: true,
    }),
    createdAt: z.string().openapi({
      description: 'Thời gian tạo (ISO 8601)',
      example: '2024-01-15T10:30:00.000Z',
    }),
    updatedAt: z.string().openapi({
      description: 'Thời gian cập nhật (ISO 8601)',
      example: '2024-01-15T10:30:00.000Z',
    }),
    latestVersion: z
      .object({
        id: z.string().openapi({
          description: 'ID phiên bản',
          example: 'cmnztabnn0000e8vmyzb8gqtn',
        }),
        versionNumber: z.string().openapi({
          description: 'Số phiên bản',
          example: 'v1.0.0',
        }),
        createdAt: z.string().openapi({
          description: 'Thời gian tạo (ISO 8601)',
          example: '2024-01-15T10:30:00.000Z',
        }),
      })
      .nullable()
      .openapi({
        description: 'Phiên bản mới nhất',
      }),
  })
  .openapi('PublicTemplateResponse');

export type PublicTemplateResponseDto = z.infer<typeof PublicTemplateResponseSchema>;

// List Public Templates Response
export const ListPublicTemplatesResponseSchema = z
  .object({
    templates: z.array(PublicTemplateResponseSchema).openapi({
      description: 'Danh sách mẫu công khai',
    }),
  })
  .openapi('ListPublicTemplatesResponse');

export type ListPublicTemplatesResponseDto = z.infer<typeof ListPublicTemplatesResponseSchema>;

// Error Response
export const ErrorResponseSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({
        description: 'Mã lỗi',
        example: 'TEMPLATE_NOT_FOUND',
      }),
      message: z.string().openapi({
        description: 'Thông báo lỗi',
        example: 'Không tìm thấy mẫu',
      }),
    }),
  })
  .openapi('ErrorResponse');

export type ErrorResponseDto = z.infer<typeof ErrorResponseSchema>;

/**
 * =========================
 * Fastify JSON Schemas
 * =========================
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

export const PublicTemplateResponseJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(PublicTemplateResponseSchema as any, 'PublicTemplateResponse'),
);

export const ListPublicTemplatesResponseJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ListPublicTemplatesResponseSchema as any, 'ListPublicTemplatesResponse'),
);

export const ErrorResponseJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ErrorResponseSchema as any, 'ErrorResponse'),
);
