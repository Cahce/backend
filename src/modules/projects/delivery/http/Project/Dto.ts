import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { TemplateCategory } from '../../../domain/Project/Types.js';

extendZodWithOpenApi(z);


export const TemplateCategorySchema = z.enum([
  'thesis',
  'project',
  'report',
  'proposal',
  'paper',
  'presentation',
  'other',
]);

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
    templateVersionId: z
      .string()
      .optional()
      .openapi({
        description: 'ID phiên bản mẫu (tùy chọn)',
        example: 'cmnztabnn0000e8vmyzb8gqtn',
      }),
  })
  .openapi('CreateProjectRequest');

export type CreateProjectRequestDto = z.infer<typeof CreateProjectRequestSchema>;

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

export const ImportProjectQuerySchema = z.object({
  category: z
    .enum(TemplateCategory)
    .optional()
    .openapi({
      description: "Loại dự án cho dự án được tạo (mặc định 'other')",
      example: TemplateCategory.Thesis,
    }),
  title: z
    .string()
    .optional()
    .openapi({
      description:
        'Tên dự án (tùy chọn) — để trống sẽ lấy tên trong project.toml, rồi đến tên tệp nén, cuối cùng "Imported <ngày>"',
      example: 'Đồ án tốt nghiệp 2026',
    }),
});

export type ImportProjectQueryDto = z.infer<typeof ImportProjectQuerySchema>;


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
    access: z
      .object({
        level: z.enum(['owner', 'editor', 'viewer', 'advisor', 'adminOversight']).openapi({
          description: 'Mức truy cập của người gọi đối với dự án',
          example: 'owner',
        }),
        canEdit: z.boolean().openapi({ description: 'Được sửa file / thông tin dự án' }),
        canDelete: z.boolean().openapi({ description: 'Được xóa dự án' }),
        canManageSettings: z.boolean().openapi({ description: 'Được đổi thiết lập dự án' }),
        canCompileOfficial: z.boolean().openapi({ description: 'Được biên dịch/xuất bản chính thức' }),
      })
      .optional()
      .openapi({ description: 'Quyền của người gọi (có trên endpoint chi tiết dự án)' }),
  })
  .openapi('ProjectResponse');

export type ProjectResponseDto = z.infer<typeof ProjectResponseSchema>;

export const ProjectListResponseSchema = z
  .object({
    projects: z.array(ProjectResponseSchema).openapi({
      description: 'Danh sách dự án, sắp xếp theo updatedAt giảm dần',
    }),
  })
  .openapi('ProjectListResponse');

export type ProjectListResponseDto = z.infer<typeof ProjectListResponseSchema>;

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

export const MessageResponseSchema = z
  .object({
    message: z.string().openapi({
      description: 'Thông báo kết quả',
      example: 'Xóa dự án thành công',
    }),
  })
  .openapi('MessageResponse');

export type MessageResponseDto = z.infer<typeof MessageResponseSchema>;


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
