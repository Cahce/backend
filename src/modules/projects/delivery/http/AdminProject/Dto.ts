import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

extendZodWithOpenApi(z);

/**
 * =========================
 * Request DTOs
 * =========================
 */

export const TemplateCategorySchema = z.enum([
  'thesis',
  'report',
  'proposal',
  'paper',
  'presentation',
  'other',
]);

export const OwnerRoleSchema = z.enum(['student', 'teacher']);

export const ListAdminProjectsQuerySchema = z
  .object({
    ownerRole: OwnerRoleSchema.optional().openapi({
      description: 'Lọc theo vai trò chủ sở hữu',
      example: 'student',
    }),
    category: TemplateCategorySchema.optional().openapi({
      description: 'Lọc theo loại dự án',
      example: 'thesis',
    }),
    search: z.string().trim().optional().openapi({
      description: 'Tìm theo tiêu đề hoặc tên/mã/email chủ sở hữu',
      example: 'Nguyễn',
    }),
    facultyId: z.string().trim().optional().openapi({
      description: 'Lọc theo ID khoa của chủ sở hữu',
    }),
    majorId: z.string().trim().optional().openapi({
      description: 'Lọc theo ID ngành (chủ sở hữu là sinh viên)',
    }),
    classId: z.string().trim().optional().openapi({
      description: 'Lọc theo ID lớp (chủ sở hữu là sinh viên)',
    }),
    departmentId: z.string().trim().optional().openapi({
      description: 'Lọc theo ID bộ môn (chủ sở hữu là giảng viên)',
    }),
    createdFrom: z.string().datetime().optional().openapi({
      description: 'Lọc createdAt >= (ISO 8601)',
      example: '2026-01-01T00:00:00.000Z',
    }),
    createdTo: z.string().datetime().optional().openapi({
      description: 'Lọc createdAt <= (ISO 8601)',
      example: '2026-05-31T23:59:59.999Z',
    }),
    updatedFrom: z.string().datetime().optional().openapi({
      description: 'Lọc updatedAt >= (ISO 8601)',
    }),
    updatedTo: z.string().datetime().optional().openapi({
      description: 'Lọc updatedAt <= (ISO 8601)',
    }),
    sort: z
      .enum(['updatedAt', 'createdAt', 'title'])
      .default('updatedAt')
      .openapi({ description: 'Trường sắp xếp', example: 'updatedAt' }),
    order: z
      .enum(['asc', 'desc'])
      .default('desc')
      .openapi({ description: 'Chiều sắp xếp', example: 'desc' }),
    page: z.coerce
      .number()
      .int()
      .min(1, 'Số trang phải >= 1')
      .default(1)
      .openapi({ description: 'Số trang', example: 1 }),
    pageSize: z.coerce
      .number()
      .int()
      .min(1, 'Kích thước trang phải >= 1')
      .max(100, 'Kích thước trang tối đa 100')
      .default(20)
      .openapi({ description: 'Số bản ghi mỗi trang', example: 20 }),
  })
  .refine(
    (v) => !(v.createdFrom && v.createdTo) || v.createdTo >= v.createdFrom,
    { message: 'createdTo phải >= createdFrom', path: ['createdTo'] },
  )
  .refine(
    (v) => !(v.updatedFrom && v.updatedTo) || v.updatedTo >= v.updatedFrom,
    { message: 'updatedTo phải >= updatedFrom', path: ['updatedTo'] },
  )
  .openapi('ListAdminProjectsQuery');

export type ListAdminProjectsQueryDto = z.infer<typeof ListAdminProjectsQuerySchema>;

export const AdminProjectStatsQuerySchema = z
  .object({
    ownerRole: OwnerRoleSchema.optional().openapi({
      description: 'Phạm vi thống kê theo vai trò',
      example: 'student',
    }),
  })
  .openapi('AdminProjectStatsQuery');

export type AdminProjectStatsQueryDto = z.infer<typeof AdminProjectStatsQuerySchema>;

/**
 * =========================
 * Response DTOs (mirror application/AdminProjectViews.ts)
 * =========================
 */

const FacultyMiniSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    code: z.string(),
  })
  .nullable();

export const AdminProjectOwnerSchema = z
  .object({
    userId: z.string(),
    email: z.string(),
    role: z.enum(['admin', 'student', 'teacher']),
    isActive: z.boolean(),
    displayName: z.string().nullable(),
    code: z.string().nullable(),
    faculty: FacultyMiniSchema,
    unit: z.string().nullable(),
  })
  .nullable()
  .openapi('AdminProjectOwner');

export const AdminProjectListItemSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    category: TemplateCategorySchema,
    createdAt: z.string(),
    updatedAt: z.string(),
    lastEditedAt: z.string().nullable(),
    fileCount: z.number(),
    hasPdf: z.boolean(),
    owner: AdminProjectOwnerSchema,
  })
  .openapi('AdminProjectListItem');

export const AdminProjectListResponseSchema = z
  .object({
    items: z.array(AdminProjectListItemSchema),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
    totalPages: z.number(),
  })
  .openapi('AdminProjectListResponse');

export const AdminProjectFileSchema = z.object({
  path: z.string(),
  kind: z.string(),
  sizeBytes: z.number().nullable(),
  updatedAt: z.string(),
});

export const AdminProjectDetailSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    category: TemplateCategorySchema,
    createdAt: z.string(),
    updatedAt: z.string(),
    lastEditedAt: z.string().nullable(),
    fileCount: z.number(),
    hasPdf: z.boolean(),
    owner: AdminProjectOwnerSchema,
    mainPath: z.string().nullable(),
    totalSizeBytes: z.number(),
    latestArtifact: z
      .object({
        id: z.string(),
        createdAt: z.string(),
        sizeBytes: z.number().nullable(),
      })
      .nullable(),
    files: z.array(AdminProjectFileSchema),
  })
  .openapi('AdminProjectDetail');

export const AdminProjectStatsSchema = z
  .object({
    total: z.number(),
    byRole: z.object({
      student: z.number(),
      teacher: z.number(),
    }),
    byCategory: z.object({
      thesis: z.number(),
      report: z.number(),
      proposal: z.number(),
      paper: z.number(),
      presentation: z.number(),
      other: z.number(),
    }),
  })
  .openapi('AdminProjectStats');

export const ErrorResponseSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: 'PROJECT_NOT_FOUND' }),
      message: z.string().openapi({ example: 'Không tìm thấy dự án' }),
    }),
  })
  .openapi('ErrorResponse');

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

export const ListAdminProjectsQueryJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ListAdminProjectsQuerySchema as any, 'ListAdminProjectsQuery'),
);

export const AdminProjectStatsQueryJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(AdminProjectStatsQuerySchema as any, 'AdminProjectStatsQuery'),
);

export const AdminProjectListResponseJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(AdminProjectListResponseSchema as any, 'AdminProjectListResponse'),
);

export const AdminProjectDetailJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(AdminProjectDetailSchema as any, 'AdminProjectDetail'),
);

export const AdminProjectStatsJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(AdminProjectStatsSchema as any, 'AdminProjectStats'),
);

export const ErrorResponseJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ErrorResponseSchema as any, 'ErrorResponse'),
);
