import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Extend Zod with OpenAPI support
extendZodWithOpenApi(z);

/**
 * =========================
 * Shared Enums
 * =========================
 */

export const TemplateCategoryEnum = z.enum([
  'thesis',
  'report',
  'proposal',
  'paper',
  'presentation',
  'other',
]).openapi({
  description: 'Danh mục mẫu',
});

/**
 * =========================
 * Request DTOs
 * =========================
 */

// Create Template Request
export const CreateTemplateRequestSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Tên mẫu là bắt buộc')
      .max(200, 'Tên mẫu tối đa 200 ký tự')
      .openapi({
        description: 'Tên mẫu',
        example: 'Khóa luận tốt nghiệp K2024',
      }),
    description: z
      .string()
      .max(2000, 'Mô tả tối đa 2000 ký tự')
      .optional()
      .openapi({
        description: 'Mô tả mẫu',
        example: 'Mẫu khóa luận tốt nghiệp cho sinh viên khóa 2024',
      }),
    category: TemplateCategoryEnum,
    isOfficial: z.boolean().default(false).openapi({
      description: 'Mẫu chính thức',
      example: true,
    }),
  })
  .openapi('CreateTemplateRequest');

export type CreateTemplateRequestDto = z.infer<typeof CreateTemplateRequestSchema>;

// Update Template Request
export const UpdateTemplateRequestSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Tên mẫu không được để trống')
      .max(200, 'Tên mẫu tối đa 200 ký tự')
      .optional()
      .openapi({
        description: 'Tên mẫu',
        example: 'Khóa luận tốt nghiệp K2024',
      }),
    description: z
      .string()
      .max(2000, 'Mô tả tối đa 2000 ký tự')
      .nullable()
      .optional()
      .openapi({
        description: 'Mô tả mẫu',
        example: 'Mẫu khóa luận tốt nghiệp cho sinh viên khóa 2024',
      }),
    category: TemplateCategoryEnum.optional(),
    isOfficial: z.boolean().optional().openapi({
      description: 'Mẫu chính thức',
      example: true,
    }),
    isActive: z.boolean().optional().openapi({
      description: 'Trạng thái hoạt động',
      example: true,
    }),
  })
  .openapi('UpdateTemplateRequest');

export type UpdateTemplateRequestDto = z.infer<typeof UpdateTemplateRequestSchema>;

// Update Template Version Request
//
// Used by PATCH /admin/templates/:id/versions/:versionId — supersedes the
// deactivate-only behaviour. Either `changelog` (set/clear) or `isActive`
// (activate/deactivate) must be present, else 400 VALIDATION_ERROR.
export const UpdateTemplateVersionRequestSchema = z
  .object({
    changelog: z
      .string()
      .max(2000, 'Ghi chú thay đổi tối đa 2000 ký tự')
      .nullable()
      .optional()
      .openapi({
        description: 'Ghi chú thay đổi mới (null để xoá)',
        example: 'Sửa lỗi chính tả trong bìa',
      }),
    isActive: z.boolean().optional().openapi({
      description: 'Bật/tắt phiên bản',
      example: false,
    }),
  })
  .refine(
    (v) => v.changelog !== undefined || v.isActive !== undefined,
    { message: 'Phải cung cấp ít nhất một trường để cập nhật' },
  )
  .openapi('UpdateTemplateVersionRequest');

export type UpdateTemplateVersionRequestDto = z.infer<
  typeof UpdateTemplateVersionRequestSchema
>;

// Create Source Project Request
//
// Used by POST /admin/templates/:id/source-project to create (or reuse) the
// admin-owned editable working copy. `seed` decides initial content: 'blank'
// scaffolds an empty Typst project; 'latest' seeds from the template's most
// recent active version.
export const CreateSourceProjectRequestSchema = z
  .object({
    seed: z.enum(['blank', 'latest']).default('blank').openapi({
      description: "Nguồn khởi tạo: 'blank' (rỗng) hoặc 'latest' (từ phiên bản mới nhất)",
      example: 'blank',
    }),
  })
  .openapi('CreateSourceProjectRequest');

export type CreateSourceProjectRequestDto = z.infer<
  typeof CreateSourceProjectRequestSchema
>;

// Publish Version From Source Request
//
// Used by POST /admin/templates/:id/versions/from-source to snapshot the
// source project's current files into a new immutable version.
export const PublishVersionFromSourceRequestSchema = z
  .object({
    versionNumber: z
      .string()
      .trim()
      .regex(/^v?\d+\.\d+\.\d+$/, 'Định dạng phải là v1.0.0 hoặc 1.0.0')
      .openapi({ description: 'Số phiên bản', example: 'v1.0.0' }),
    changelog: z
      .string()
      .max(2000, 'Ghi chú thay đổi tối đa 2000 ký tự')
      .nullable()
      .optional()
      .openapi({
        description: 'Ghi chú thay đổi',
        example: 'Phiên bản đầu tiên',
      }),
  })
  .openapi('PublishVersionFromSourceRequest');

export type PublishVersionFromSourceRequestDto = z.infer<
  typeof PublishVersionFromSourceRequestSchema
>;

// List Templates Query Parameters
export const ListTemplatesQuerySchema = z
  .object({
    search: z
      .string()
      .trim()
      .optional()
      .openapi({
        description: 'Tìm kiếm theo tên hoặc mô tả',
        example: 'khóa luận',
      }),
    category: TemplateCategoryEnum.optional(),
    isOfficial: z
      .enum(['true', 'false'])
      .optional()
      .openapi({
        description: 'Lọc theo mẫu chính thức',
        example: 'true',
      }),
    isActive: z
      .enum(['true', 'false'])
      .optional()
      .openapi({
        description: 'Lọc theo trạng thái hoạt động',
        example: 'true',
      }),
    page: z.coerce
      .number()
      .int()
      .min(1, 'Số trang phải lớn hơn hoặc bằng 1')
      .default(1)
      .openapi({
        description: 'Số trang',
        example: 1,
      }),
    pageSize: z.coerce
      .number()
      .int()
      .min(1, 'Kích thước trang phải lớn hơn hoặc bằng 1')
      .max(100, 'Kích thước trang tối đa là 100')
      .default(20)
      .openapi({
        description: 'Số lượng bản ghi mỗi trang',
        example: 20,
      }),
  })
  .openapi('ListTemplatesQuery');

export type ListTemplatesQueryDto = z.infer<typeof ListTemplatesQuerySchema>;

/**
 * =========================
 * Response DTOs
 * =========================
 */

// Template Response
//
// `usageCount` is the number of projects referencing this template (either via
// `Project.templateId` or via `Project.templateVersion.templateId`). Always
// present on admin responses; never exposed on the public `/templates` route.
export const TemplateResponseSchema = z
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
    isActive: z.boolean().openapi({
      description: 'Trạng thái hoạt động',
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
    usageCount: z.number().int().nonnegative().optional().openapi({
      description:
        'Số project đang dùng mẫu này (bất kỳ phiên bản nào). Chỉ trả về cho các endpoint admin list/detail; có thể vắng mặt ở các response khác.',
      example: 0,
    }),
    sourceProjectId: z.string().nullable().optional().openapi({
      description:
        'ID project nguồn (bản nháp admin dùng để soạn nội dung mẫu trong workspace). null nếu mẫu chưa có project nguồn.',
      example: null,
    }),
  })
  .openapi('TemplateResponse');

export type TemplateResponseDto = z.infer<typeof TemplateResponseSchema>;

// Template Version Response
export const TemplateVersionResponseSchema = z
  .object({
    id: z.string().openapi({
      description: 'ID phiên bản',
      example: 'cmnztabnn0000e8vmyzb8gqtn',
    }),
    templateId: z.string().openapi({
      description: 'ID mẫu',
      example: 'cmnztabnn0000e8vmyzb8gqtn',
    }),
    versionNumber: z.string().openapi({
      description: 'Số phiên bản',
      example: 'v1.0.0',
    }),
    changelog: z.string().nullable().openapi({
      description: 'Ghi chú thay đổi',
      example: 'Phiên bản đầu tiên',
    }),
    isActive: z.boolean().openapi({
      description: 'Trạng thái hoạt động',
      example: true,
    }),
    createdAt: z.string().openapi({
      description: 'Thời gian tạo (ISO 8601)',
      example: '2024-01-15T10:30:00.000Z',
    }),
  })
  .openapi('TemplateVersionResponse');

export type TemplateVersionResponseDto = z.infer<typeof TemplateVersionResponseSchema>;

// List Templates Response
export const ListTemplatesResponseSchema = z
  .object({
    items: z.array(TemplateResponseSchema).openapi({
      description: 'Danh sách mẫu',
    }),
    total: z.number().openapi({
      description: 'Tổng số bản ghi',
      example: 50,
    }),
    page: z.number().openapi({
      description: 'Trang hiện tại',
      example: 1,
    }),
    pageSize: z.number().openapi({
      description: 'Số lượng bản ghi mỗi trang',
      example: 20,
    }),
    totalPages: z.number().openapi({
      description: 'Tổng số trang',
      example: 3,
    }),
  })
  .openapi('ListTemplatesResponse');

export type ListTemplatesResponseDto = z.infer<typeof ListTemplatesResponseSchema>;

// List Versions Response
export const ListVersionsResponseSchema = z
  .object({
    versions: z.array(TemplateVersionResponseSchema).openapi({
      description: 'Danh sách phiên bản',
    }),
  })
  .openapi('ListVersionsResponse');

export type ListVersionsResponseDto = z.infer<typeof ListVersionsResponseSchema>;

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

// Message Response
export const MessageResponseSchema = z
  .object({
    message: z.string().openapi({
      description: 'Thông báo kết quả',
      example: 'Xóa mẫu thành công',
    }),
  })
  .openapi('MessageResponse');

export type MessageResponseDto = z.infer<typeof MessageResponseSchema>;

// Source Project Response — returns the id of the template's editable working
// copy so the frontend can navigate to `/workspace/:id?templateId=...`.
export const SourceProjectResponseSchema = z
  .object({
    sourceProjectId: z.string().openapi({
      description: 'ID project nguồn của mẫu',
      example: 'cmnztabnn0000e8vmyzb8gqtn',
    }),
  })
  .openapi('SourceProjectResponse');

export type SourceProjectResponseDto = z.infer<typeof SourceProjectResponseSchema>;

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

export const CreateTemplateBodyJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(CreateTemplateRequestSchema as any, 'CreateTemplateRequest'),
);

export const UpdateTemplateBodyJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(UpdateTemplateRequestSchema as any, 'UpdateTemplateRequest'),
);

export const UpdateTemplateVersionBodyJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(
    UpdateTemplateVersionRequestSchema as any,
    'UpdateTemplateVersionRequest',
  ),
);

export const ListTemplatesQueryJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ListTemplatesQuerySchema as any, 'ListTemplatesQuery'),
);

export const TemplateResponseJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(TemplateResponseSchema as any, 'TemplateResponse'),
);

export const TemplateVersionResponseJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(TemplateVersionResponseSchema as any, 'TemplateVersionResponse'),
);

export const ListTemplatesResponseJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ListTemplatesResponseSchema as any, 'ListTemplatesResponse'),
);

export const ListVersionsResponseJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ListVersionsResponseSchema as any, 'ListVersionsResponse'),
);

export const ErrorResponseJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ErrorResponseSchema as any, 'ErrorResponse'),
);

export const MessageResponseJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(MessageResponseSchema as any, 'MessageResponse'),
);

export const CreateSourceProjectBodyJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(
    CreateSourceProjectRequestSchema as any,
    'CreateSourceProjectRequest',
  ),
);

export const PublishVersionFromSourceBodyJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(
    PublishVersionFromSourceRequestSchema as any,
    'PublishVersionFromSourceRequest',
  ),
);

export const SourceProjectResponseJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(SourceProjectResponseSchema as any, 'SourceProjectResponse'),
);
