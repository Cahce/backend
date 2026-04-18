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

// File Kind Schema
export const FileKindSchema = z.enum(['typst', 'bib', 'image', 'data', 'other']);

// Create File Request
export const CreateFileRequestSchema = z
  .object({
    path: z
      .string()
      .trim()
      .min(1, 'Đường dẫn tệp là bắt buộc')
      .openapi({
        description: 'Đường dẫn tệp (tương đối với thư mục gốc dự án)',
        example: 'main.typ',
      }),
    kind: FileKindSchema.openapi({
      description: 'Loại tệp',
      example: 'typst',
    }),
    content: z.string().openapi({
      description: 'Nội dung tệp (UTF-8 text)',
      example: '#heading[My Document]',
    }),
    mimeType: z.string().optional().openapi({
      description: 'MIME type (tùy chọn)',
      example: 'text/plain',
    }),
  })
  .openapi('CreateFileRequest');

export type CreateFileRequestDto = z.infer<typeof CreateFileRequestSchema>;

// Update File Request
export const UpdateFileRequestSchema = z
  .object({
    content: z.string().openapi({
      description: 'Nội dung tệp mới (UTF-8 text)',
      example: '#heading[Updated Document]',
    }),
  })
  .openapi('UpdateFileRequest');

export type UpdateFileRequestDto = z.infer<typeof UpdateFileRequestSchema>;

// Rename File Request
export const RenameFileRequestSchema = z
  .object({
    newPath: z
      .string()
      .trim()
      .min(1, 'Đường dẫn mới là bắt buộc')
      .openapi({
        description: 'Đường dẫn mới của tệp',
        example: 'chapters/intro.typ',
      }),
  })
  .openapi('RenameFileRequest');

export type RenameFileRequestDto = z.infer<typeof RenameFileRequestSchema>;

/**
 * =========================
 * Response DTOs
 * =========================
 */

// File Metadata Response (excludes content)
export const FileMetadataSchema = z
  .object({
    id: z.string().openapi({
      description: 'ID tệp',
      example: 'cmnztabnn0000e8vmyzb8gqtn',
    }),
    projectId: z.string().openapi({
      description: 'ID dự án',
      example: 'project123',
    }),
    path: z.string().openapi({
      description: 'Đường dẫn tệp',
      example: 'main.typ',
    }),
    kind: FileKindSchema.openapi({
      description: 'Loại tệp',
      example: 'typst',
    }),
    mimeType: z.string().nullable().openapi({
      description: 'MIME type',
      example: 'text/plain',
    }),
    sizeBytes: z.number().nullable().openapi({
      description: 'Kích thước tệp (bytes)',
      example: 1024,
    }),
    lastEditedAt: z.string().nullable().openapi({
      description: 'Thời gian chỉnh sửa cuối (ISO 8601)',
      example: '2024-01-15T10:30:00.000Z',
    }),
    createdAt: z.string().openapi({
      description: 'Thời gian tạo (ISO 8601)',
      example: '2024-01-15T10:30:00.000Z',
    }),
    updatedAt: z.string().openapi({
      description: 'Thời gian cập nhật (ISO 8601)',
      example: '2024-01-15T10:30:00.000Z',
    }),
  })
  .openapi('FileMetadata');

export type FileMetadataDto = z.infer<typeof FileMetadataSchema>;

// File Response (includes content)
export const FileResponseSchema = z
  .object({
    id: z.string().openapi({
      description: 'ID tệp',
      example: 'cmnztabnn0000e8vmyzb8gqtn',
    }),
    projectId: z.string().openapi({
      description: 'ID dự án',
      example: 'project123',
    }),
    path: z.string().openapi({
      description: 'Đường dẫn tệp',
      example: 'main.typ',
    }),
    kind: FileKindSchema.openapi({
      description: 'Loại tệp',
      example: 'typst',
    }),
    content: z.string().nullable().openapi({
      description: 'Nội dung tệp (inline storage)',
      example: '#heading[My Document]',
    }),
    storageKey: z.string().nullable().openapi({
      description: 'Storage key (object storage)',
      example: null,
    }),
    mimeType: z.string().nullable().openapi({
      description: 'MIME type',
      example: 'text/plain',
    }),
    sizeBytes: z.number().nullable().openapi({
      description: 'Kích thước tệp (bytes)',
      example: 1024,
    }),
    sha256: z.string().nullable().openapi({
      description: 'SHA-256 hash',
      example: 'abc123...',
    }),
    lastEditedAt: z.string().nullable().openapi({
      description: 'Thời gian chỉnh sửa cuối (ISO 8601)',
      example: '2024-01-15T10:30:00.000Z',
    }),
    createdAt: z.string().openapi({
      description: 'Thời gian tạo (ISO 8601)',
      example: '2024-01-15T10:30:00.000Z',
    }),
    updatedAt: z.string().openapi({
      description: 'Thời gian cập nhật (ISO 8601)',
      example: '2024-01-15T10:30:00.000Z',
    }),
  })
  .openapi('FileResponse');

export type FileResponseDto = z.infer<typeof FileResponseSchema>;

// File List Response
export const FileListResponseSchema = z
  .object({
    files: z.array(FileMetadataSchema).openapi({
      description: 'Danh sách tệp, sắp xếp theo path tăng dần',
    }),
  })
  .openapi('FileListResponse');

export type FileListResponseDto = z.infer<typeof FileListResponseSchema>;

// Error Response
export const ErrorResponseSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({
        description: 'Mã lỗi',
        example: 'FILE_NOT_FOUND',
      }),
      message: z.string().openapi({
        description: 'Thông báo lỗi',
        example: 'Không tìm thấy tệp',
      }),
    }),
  })
  .openapi('ErrorResponse');

export type ErrorResponseDto = z.infer<typeof ErrorResponseSchema>;

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

export const CreateFileBodyJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(CreateFileRequestSchema as any, 'CreateFileRequest'),
);

export const UpdateFileBodyJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(UpdateFileRequestSchema as any, 'UpdateFileRequest'),
);

export const RenameFileBodyJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(RenameFileRequestSchema as any, 'RenameFileRequest'),
);

export const FileMetadataJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(FileMetadataSchema as any, 'FileMetadata'),
);

export const FileResponseJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(FileResponseSchema as any, 'FileResponse'),
);

export const FileListResponseJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(FileListResponseSchema as any, 'FileListResponse'),
);

export const ErrorResponseJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ErrorResponseSchema as any, 'ErrorResponse'),
);
