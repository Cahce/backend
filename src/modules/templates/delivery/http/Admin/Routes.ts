import type { FastifyInstance } from 'fastify';
import type { TemplatesContainer } from '../../../Container.js';
import { TemplateCategory } from '../../../domain/Types.js';
import {
  CreateTemplateRequestSchema,
  UpdateTemplateRequestSchema,
  ListTemplatesQuerySchema,
  UpdateTemplateVersionRequestSchema,
  CreateSourceProjectRequestSchema,
  PublishVersionFromSourceRequestSchema,
  type CreateTemplateRequestDto,
  type UpdateTemplateRequestDto,
  type ListTemplatesQueryDto,
  type UpdateTemplateVersionRequestDto,
  type CreateSourceProjectRequestDto,
  type PublishVersionFromSourceRequestDto,
  CreateTemplateBodyJsonSchema,
  UpdateTemplateBodyJsonSchema,
  ListTemplatesQueryJsonSchema,
  UpdateTemplateVersionBodyJsonSchema,
  CreateSourceProjectBodyJsonSchema,
  PublishVersionFromSourceBodyJsonSchema,
  SourceProjectResponseJsonSchema,
  TemplateResponseJsonSchema,
  TemplateVersionResponseJsonSchema,
  ListTemplatesResponseJsonSchema,
  ListVersionsResponseJsonSchema,
  ErrorResponseJsonSchema,
  MessageResponseJsonSchema,
} from './Dto.js';

/**
 * Admin template routes
 */
export async function adminTemplateRoutes(app: FastifyInstance, container: TemplatesContainer) {
  // POST /api/v1/admin/templates - create template
  app.post<{ Body: CreateTemplateRequestDto }>(
    '/templates',
    {
      preHandler: app.auth.requireAdmin,
      schema: {
        description: 'Tạo mẫu mới',
        tags: ['admin-templates'],
        security: [{ bearerAuth: [] }],
        body: CreateTemplateBodyJsonSchema,
        response: {
          201: {
            description: 'Tạo mẫu thành công',
            ...TemplateResponseJsonSchema,
          },
          400: {
            description: 'Dữ liệu đầu vào không hợp lệ',
            ...ErrorResponseJsonSchema,
          },
          401: {
            description: 'Chưa đăng nhập hoặc token không hợp lệ',
            ...ErrorResponseJsonSchema,
          },
          403: {
            description: 'Không có quyền truy cập (chỉ admin)',
            ...ErrorResponseJsonSchema,
          },
          500: {
            description: 'Lỗi hệ thống',
            ...ErrorResponseJsonSchema,
          },
        },
      },
    },
    async (request, reply) => {
      const parseResult = CreateTemplateRequestSchema.safeParse(request.body);

      if (!parseResult.success) {
        const firstError = parseResult.error.issues[0];
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: firstError.message,
          },
        });
      }

      const result = await container.createTemplate.execute({
        name: parseResult.data.name,
        description: parseResult.data.description || null,
        category: parseResult.data.category as TemplateCategory,
        isOfficial: parseResult.data.isOfficial,
      });

      if (result.success) {
        return reply.code(201).send({
          id: result.data.id,
          name: result.data.name,
          description: result.data.description,
          category: result.data.category,
          isOfficial: result.data.isOfficial,
          isActive: result.data.isActive,
          createdAt: result.data.createdAt.toISOString(),
          updatedAt: result.data.updatedAt.toISOString(),
          sourceProjectId: result.data.sourceProjectId ?? null,
        });
      }

      return reply.code(getStatusCodeForError(result.error.code)).send({
        error: result.error,
      });
    },
  );

  // GET /api/v1/admin/templates - list templates with pagination and search
  app.get<{ Querystring: ListTemplatesQueryDto }>(
    '/templates',
    {
      preHandler: app.auth.requireAdmin,
      schema: {
        description: 'Lấy danh sách mẫu',
        tags: ['admin-templates'],
        security: [{ bearerAuth: [] }],
        querystring: ListTemplatesQueryJsonSchema,
        response: {
          200: {
            description: 'Lấy danh sách mẫu thành công',
            ...ListTemplatesResponseJsonSchema,
          },
          400: {
            description: 'Query params không hợp lệ',
            ...ErrorResponseJsonSchema,
          },
          401: {
            description: 'Chưa đăng nhập hoặc token không hợp lệ',
            ...ErrorResponseJsonSchema,
          },
          403: {
            description: 'Không có quyền truy cập (chỉ admin)',
            ...ErrorResponseJsonSchema,
          },
          500: {
            description: 'Lỗi hệ thống',
            ...ErrorResponseJsonSchema,
          },
        },
      },
    },
    async (request, reply) => {
      const parseResult = ListTemplatesQuerySchema.safeParse(request.query);

      if (!parseResult.success) {
        const firstError = parseResult.error.issues[0];
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: firstError.message,
          },
        });
      }

      const result = await container.listTemplates.execute({
        search: parseResult.data.search,
        category: parseResult.data.category as TemplateCategory | undefined,
        isOfficial: parseResult.data.isOfficial === 'true' ? true : parseResult.data.isOfficial === 'false' ? false : undefined,
        isActive: parseResult.data.isActive === 'true' ? true : parseResult.data.isActive === 'false' ? false : undefined,
        page: parseResult.data.page,
        pageSize: parseResult.data.pageSize,
      });

      if (result.success) {
        return reply.code(200).send({
          items: result.data.items.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            category: t.category,
            isOfficial: t.isOfficial,
            isActive: t.isActive,
            createdAt: t.createdAt.toISOString(),
            updatedAt: t.updatedAt.toISOString(),
            usageCount: t.usageCount,
            sourceProjectId: t.sourceProjectId ?? null,
          })),
          total: result.data.total,
          page: result.data.page,
          pageSize: result.data.pageSize,
          totalPages: result.data.totalPages,
        });
      }

      return reply.code(getStatusCodeForError(result.error.code)).send({
        error: result.error,
      });
    },
  );

  // GET /api/v1/admin/templates/:id - get template by id
  app.get<{ Params: { id: string } }>(
    '/templates/:id',
    {
      preHandler: app.auth.requireAdmin,
      schema: {
        description: 'Lấy chi tiết mẫu theo ID',
        tags: ['admin-templates'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'ID của mẫu',
            },
          },
        },
        response: {
          200: {
            description: 'Lấy chi tiết mẫu thành công',
            ...TemplateResponseJsonSchema,
          },
          401: {
            description: 'Chưa đăng nhập hoặc token không hợp lệ',
            ...ErrorResponseJsonSchema,
          },
          403: {
            description: 'Không có quyền truy cập (chỉ admin)',
            ...ErrorResponseJsonSchema,
          },
          404: {
            description: 'Không tìm thấy mẫu',
            ...ErrorResponseJsonSchema,
          },
          500: {
            description: 'Lỗi hệ thống',
            ...ErrorResponseJsonSchema,
          },
        },
      },
    },
    async (request, reply) => {
      const result = await container.getTemplateById.execute(request.params.id);

      if (result.success) {
        return reply.code(200).send({
          id: result.data.id,
          name: result.data.name,
          description: result.data.description,
          category: result.data.category,
          isOfficial: result.data.isOfficial,
          isActive: result.data.isActive,
          createdAt: result.data.createdAt.toISOString(),
          updatedAt: result.data.updatedAt.toISOString(),
          usageCount: result.data.usageCount,
          sourceProjectId: result.data.sourceProjectId ?? null,
        });
      }

      return reply.code(getStatusCodeForError(result.error.code)).send({
        error: result.error,
      });
    },
  );

  // PATCH /api/v1/admin/templates/:id - update template
  app.patch<{ Params: { id: string }; Body: UpdateTemplateRequestDto }>(
    '/templates/:id',
    {
      preHandler: app.auth.requireAdmin,
      schema: {
        description: 'Cập nhật mẫu',
        tags: ['admin-templates'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'ID của mẫu',
            },
          },
        },
        body: UpdateTemplateBodyJsonSchema,
        response: {
          200: {
            description: 'Cập nhật mẫu thành công',
            ...TemplateResponseJsonSchema,
          },
          400: {
            description: 'Dữ liệu đầu vào không hợp lệ',
            ...ErrorResponseJsonSchema,
          },
          401: {
            description: 'Chưa đăng nhập hoặc token không hợp lệ',
            ...ErrorResponseJsonSchema,
          },
          403: {
            description: 'Không có quyền truy cập (chỉ admin)',
            ...ErrorResponseJsonSchema,
          },
          404: {
            description: 'Không tìm thấy mẫu',
            ...ErrorResponseJsonSchema,
          },
          500: {
            description: 'Lỗi hệ thống',
            ...ErrorResponseJsonSchema,
          },
        },
      },
    },
    async (request, reply) => {
      const parseResult = UpdateTemplateRequestSchema.safeParse(request.body);

      if (!parseResult.success) {
        const firstError = parseResult.error.issues[0];
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: firstError.message,
          },
        });
      }

      const result = await container.updateTemplate.execute(request.params.id, {
        name: parseResult.data.name,
        description: parseResult.data.description,
        category: parseResult.data.category as TemplateCategory | undefined,
        isOfficial: parseResult.data.isOfficial,
        isActive: parseResult.data.isActive,
      });

      if (result.success) {
        return reply.code(200).send({
          id: result.data.id,
          name: result.data.name,
          description: result.data.description,
          category: result.data.category,
          isOfficial: result.data.isOfficial,
          isActive: result.data.isActive,
          createdAt: result.data.createdAt.toISOString(),
          updatedAt: result.data.updatedAt.toISOString(),
          sourceProjectId: result.data.sourceProjectId ?? null,
        });
      }

      return reply.code(getStatusCodeForError(result.error.code)).send({
        error: result.error,
      });
    },
  );

  // DELETE /api/v1/admin/templates/:id - delete template
  app.delete<{ Params: { id: string } }>(
    '/templates/:id',
    {
      preHandler: app.auth.requireAdmin,
      schema: {
        description: 'Xóa mẫu',
        tags: ['admin-templates'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'ID của mẫu',
            },
          },
        },
        response: {
          200: {
            description: 'Xóa mẫu thành công',
            ...MessageResponseJsonSchema,
          },
          401: {
            description: 'Chưa đăng nhập hoặc token không hợp lệ',
            ...ErrorResponseJsonSchema,
          },
          403: {
            description: 'Không có quyền truy cập (chỉ admin)',
            ...ErrorResponseJsonSchema,
          },
          404: {
            description: 'Không tìm thấy mẫu',
            ...ErrorResponseJsonSchema,
          },
          409: {
            description: 'Không thể xóa mẫu đang được sử dụng',
            ...ErrorResponseJsonSchema,
          },
          500: {
            description: 'Lỗi hệ thống',
            ...ErrorResponseJsonSchema,
          },
        },
      },
    },
    async (request, reply) => {
      const result = await container.deleteTemplate.execute(request.params.id);

      if (result.success) {
        return reply.code(200).send({
          message: 'Xóa mẫu thành công',
        });
      }

      return reply.code(getStatusCodeForError(result.error.code)).send({
        error: result.error,
      });
    },
  );

  // POST /api/v1/admin/templates/:id/versions - create template version (multipart)
  app.post<{ Params: { id: string } }>(
    '/templates/:id/versions',
    {
      preHandler: app.auth.requireAdmin,
      schema: {
        description: 'Tạo phiên bản mẫu mới (upload file)',
        tags: ['admin-templates'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'ID của mẫu',
            },
          },
        },
        consumes: ['multipart/form-data'],
        response: {
          201: {
            description: 'Tạo phiên bản thành công',
            ...TemplateVersionResponseJsonSchema,
          },
          400: {
            description: 'Dữ liệu đầu vào không hợp lệ',
            ...ErrorResponseJsonSchema,
          },
          401: {
            description: 'Chưa đăng nhập hoặc token không hợp lệ',
            ...ErrorResponseJsonSchema,
          },
          403: {
            description: 'Không có quyền truy cập (chỉ admin)',
            ...ErrorResponseJsonSchema,
          },
          404: {
            description: 'Không tìm thấy mẫu',
            ...ErrorResponseJsonSchema,
          },
          409: {
            description: 'Phiên bản đã tồn tại',
            ...ErrorResponseJsonSchema,
          },
          413: {
            description: 'Tệp quá lớn',
            ...ErrorResponseJsonSchema,
          },
          500: {
            description: 'Lỗi hệ thống',
            ...ErrorResponseJsonSchema,
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const data = await request.file();

        if (!data) {
          return reply.code(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Thiếu tệp tải lên',
            },
          });
        }

        // Get form fields - @fastify/multipart v9 returns fields as objects
        const fields = data.fields as Record<string, { value: string }>;
        const versionNumber = fields.versionNumber?.value;
        const changelog = fields.changelog?.value;

        if (!versionNumber) {
          return reply.code(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Thiếu số phiên bản',
            },
          });
        }

        // Determine archive type
        const filename = data.filename.toLowerCase();
        let archiveType: 'typ' | 'zip';
        if (filename.endsWith('.typ')) {
          archiveType = 'typ';
        } else if (filename.endsWith('.zip')) {
          archiveType = 'zip';
        } else {
          return reply.code(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Chỉ hỗ trợ tệp .typ hoặc .zip',
            },
          });
        }

        const result = await container.createTemplateVersion.execute({
          templateId: request.params.id,
          versionNumber,
          changelog: changelog || null,
          archive: data.file,
          archiveType,
        });

        if (result.success) {
          return reply.code(201).send({
            id: result.data.id,
            templateId: result.data.templateId,
            versionNumber: result.data.versionNumber,
            changelog: result.data.changelog,
            isActive: result.data.isActive,
            createdAt: result.data.createdAt.toISOString(),
          });
        }

        return reply.code(getStatusCodeForError(result.error.code)).send({
          error: result.error,
        });
      } catch (error) {
        return reply.code(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Lỗi hệ thống',
          },
        });
      }
    },
  );

  // GET /api/v1/admin/templates/:id/versions - list versions by template
  app.get<{ Params: { id: string } }>(
    '/templates/:id/versions',
    {
      preHandler: app.auth.requireAdmin,
      schema: {
        description: 'Lấy danh sách phiên bản của mẫu',
        tags: ['admin-templates'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'ID của mẫu',
            },
          },
        },
        response: {
          200: {
            description: 'Lấy danh sách phiên bản thành công',
            ...ListVersionsResponseJsonSchema,
          },
          401: {
            description: 'Chưa đăng nhập hoặc token không hợp lệ',
            ...ErrorResponseJsonSchema,
          },
          403: {
            description: 'Không có quyền truy cập (chỉ admin)',
            ...ErrorResponseJsonSchema,
          },
          404: {
            description: 'Không tìm thấy mẫu',
            ...ErrorResponseJsonSchema,
          },
          500: {
            description: 'Lỗi hệ thống',
            ...ErrorResponseJsonSchema,
          },
        },
      },
    },
    async (request, reply) => {
      const result = await container.listVersionsByTemplate.execute(request.params.id);

      if (result.success) {
        return reply.code(200).send({
          versions: result.data.versions.map((v) => ({
            id: v.id,
            templateId: v.templateId,
            versionNumber: v.versionNumber,
            changelog: v.changelog,
            isActive: v.isActive,
            createdAt: v.createdAt.toISOString(),
          })),
        });
      }

      return reply.code(getStatusCodeForError(result.error.code)).send({
        error: result.error,
      });
    },
  );

  // PATCH /api/v1/admin/templates/:id/versions/:versionId
  //   Body accepts: { changelog?: string | null; isActive?: boolean }
  //   At least one field must be present. Supersedes the previous
  //   deactivate-only behaviour — clients that used to send `{}` to deactivate
  //   must now send `{ isActive: false }` explicitly.
  app.patch<{
    Params: { id: string; versionId: string };
    Body: UpdateTemplateVersionRequestDto;
  }>(
    '/templates/:id/versions/:versionId',
    {
      preHandler: app.auth.requireAdmin,
      schema: {
        description:
          'Cập nhật phiên bản mẫu (sửa ghi chú thay đổi và/hoặc bật/tắt phiên bản)',
        tags: ['admin-templates'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id', 'versionId'],
          properties: {
            id: {
              type: 'string',
              description: 'ID của mẫu',
            },
            versionId: {
              type: 'string',
              description: 'ID của phiên bản',
            },
          },
        },
        body: UpdateTemplateVersionBodyJsonSchema,
        response: {
          200: {
            description: 'Cập nhật phiên bản thành công',
            ...TemplateVersionResponseJsonSchema,
          },
          400: {
            description: 'Body rỗng hoặc dữ liệu không hợp lệ',
            ...ErrorResponseJsonSchema,
          },
          401: {
            description: 'Chưa đăng nhập hoặc token không hợp lệ',
            ...ErrorResponseJsonSchema,
          },
          403: {
            description: 'Không có quyền truy cập (chỉ admin)',
            ...ErrorResponseJsonSchema,
          },
          404: {
            description: 'Không tìm thấy phiên bản',
            ...ErrorResponseJsonSchema,
          },
          500: {
            description: 'Lỗi hệ thống',
            ...ErrorResponseJsonSchema,
          },
        },
      },
    },
    async (request, reply) => {
      const parseResult = UpdateTemplateVersionRequestSchema.safeParse(
        request.body,
      );
      if (!parseResult.success) {
        const firstError = parseResult.error.issues[0];
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: firstError.message,
          },
        });
      }

      const result = await container.updateTemplateVersion.execute({
        versionId: request.params.versionId,
        patch: parseResult.data,
      });

      if (result.success) {
        return reply.code(200).send({
          id: result.data.id,
          templateId: result.data.templateId,
          versionNumber: result.data.versionNumber,
          changelog: result.data.changelog,
          isActive: result.data.isActive,
          createdAt: result.data.createdAt.toISOString(),
        });
      }

      return reply.code(getStatusCodeForError(result.error.code)).send({
        error: result.error,
      });
    },
  );

  // GET /api/v1/admin/templates/:id/versions/:versionId/file
  //   Streams the version's archive content as a .zip download. Always a zip,
  //   even when the original upload was a single .typ file — the storage
  //   gateway re-bundles the directory.
  app.get<{ Params: { id: string; versionId: string } }>(
    '/templates/:id/versions/:versionId/file',
    {
      preHandler: app.auth.requireAdmin,
      schema: {
        description: 'Tải xuống nội dung phiên bản dưới dạng .zip',
        tags: ['admin-templates'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id', 'versionId'],
          properties: {
            id: { type: 'string', description: 'ID của mẫu' },
            versionId: { type: 'string', description: 'ID của phiên bản' },
          },
        },
        response: {
          // No JSON schema for 200 — body is a binary blob.
          401: { description: 'Chưa đăng nhập', ...ErrorResponseJsonSchema },
          403: { description: 'Không có quyền', ...ErrorResponseJsonSchema },
          404: {
            description: 'Không tìm thấy mẫu hoặc phiên bản',
            ...ErrorResponseJsonSchema,
          },
          500: { description: 'Lỗi hệ thống', ...ErrorResponseJsonSchema },
        },
      },
    },
    async (request, reply) => {
      const result = await container.getTemplateVersionFile.execute({
        templateId: request.params.id,
        versionId: request.params.versionId,
      });

      if (!result.success) {
        return reply.code(getStatusCodeForError(result.error.code)).send({
          error: result.error,
        });
      }

      reply
        .header('Content-Type', result.data.contentType)
        .header(
          'Content-Disposition',
          `attachment; filename="${result.data.filename}"`,
        )
        .header('Content-Length', String(result.data.buffer.length));
      return reply.send(result.data.buffer);
    },
  );

  // POST /api/v1/admin/templates/:id/source-project
  //   Create (or reuse) the template's editable source project. The frontend
  //   then opens it in the workspace via `/workspace/:sourceProjectId?templateId=`.
  app.post<{ Params: { id: string }; Body: CreateSourceProjectRequestDto }>(
    '/templates/:id/source-project',
    {
      preHandler: app.auth.requireAdmin,
      schema: {
        description: 'Tạo (hoặc lấy lại) project nguồn để soạn nội dung mẫu trong workspace',
        tags: ['admin-templates'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', description: 'ID của mẫu' } },
        },
        body: CreateSourceProjectBodyJsonSchema,
        response: {
          201: { description: 'Đã tạo/lấy project nguồn', ...SourceProjectResponseJsonSchema },
          400: { description: 'Dữ liệu không hợp lệ', ...ErrorResponseJsonSchema },
          401: { description: 'Chưa đăng nhập', ...ErrorResponseJsonSchema },
          403: { description: 'Không có quyền truy cập (chỉ admin)', ...ErrorResponseJsonSchema },
          404: { description: 'Không tìm thấy mẫu', ...ErrorResponseJsonSchema },
          500: { description: 'Lỗi hệ thống', ...ErrorResponseJsonSchema },
        },
      },
    },
    async (request, reply) => {
      if (!container.createTemplateSourceProject) {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống' },
        });
      }

      const parseResult = CreateSourceProjectRequestSchema.safeParse(
        request.body ?? {},
      );
      if (!parseResult.success) {
        const firstError = parseResult.error.issues[0];
        return reply.code(400).send({
          error: { code: 'VALIDATION_ERROR', message: firstError.message },
        });
      }

      const result = await container.createTemplateSourceProject.execute({
        templateId: request.params.id,
        ownerId: request.user.sub,
        seed: parseResult.data.seed,
      });

      if (result.success) {
        return reply.code(201).send({ sourceProjectId: result.data.sourceProjectId });
      }
      return reply.code(getStatusCodeForError(result.error.code)).send({
        error: result.error,
      });
    },
  );

  // POST /api/v1/admin/templates/:id/source-project/import (multipart)
  //   Create the template's source project seeded from an uploaded .zip.
  app.post<{ Params: { id: string } }>(
    '/templates/:id/source-project/import',
    {
      preHandler: app.auth.requireAdmin,
      schema: {
        description: 'Tạo project nguồn từ tệp .zip để soạn nội dung mẫu',
        tags: ['admin-templates'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', description: 'ID của mẫu' } },
        },
        consumes: ['multipart/form-data'],
        response: {
          201: { description: 'Đã tạo project nguồn', ...SourceProjectResponseJsonSchema },
          400: { description: 'Dữ liệu không hợp lệ', ...ErrorResponseJsonSchema },
          401: { description: 'Chưa đăng nhập', ...ErrorResponseJsonSchema },
          403: { description: 'Không có quyền truy cập (chỉ admin)', ...ErrorResponseJsonSchema },
          404: { description: 'Không tìm thấy mẫu', ...ErrorResponseJsonSchema },
          413: { description: 'Tệp quá lớn', ...ErrorResponseJsonSchema },
          500: { description: 'Lỗi hệ thống', ...ErrorResponseJsonSchema },
        },
      },
    },
    async (request, reply) => {
      if (!container.importTemplateSourceProject) {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống' },
        });
      }

      try {
        const data = await request.file();
        if (!data) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Thiếu tệp tải lên' },
          });
        }
        if (!data.filename.toLowerCase().endsWith('.zip')) {
          return reply.code(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Chỉ hỗ trợ tệp .zip' },
          });
        }

        const zipBuffer = await data.toBuffer();

        const result = await container.importTemplateSourceProject.execute({
          templateId: request.params.id,
          ownerId: request.user.sub,
          zipBuffer,
        });

        if (result.success) {
          return reply.code(201).send({ sourceProjectId: result.data.sourceProjectId });
        }
        return reply.code(getStatusCodeForError(result.error.code)).send({
          error: result.error,
        });
      } catch (error) {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống' },
        });
      }
    },
  );

  // POST /api/v1/admin/templates/:id/versions/from-source
  //   Publish a new immutable version by snapshotting the source project files.
  app.post<{ Params: { id: string }; Body: PublishVersionFromSourceRequestDto }>(
    '/templates/:id/versions/from-source',
    {
      preHandler: app.auth.requireAdmin,
      schema: {
        description: 'Phát hành phiên bản mẫu từ nội dung project nguồn',
        tags: ['admin-templates'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', description: 'ID của mẫu' } },
        },
        body: PublishVersionFromSourceBodyJsonSchema,
        response: {
          201: { description: 'Phát hành phiên bản thành công', ...TemplateVersionResponseJsonSchema },
          400: { description: 'Dữ liệu không hợp lệ', ...ErrorResponseJsonSchema },
          401: { description: 'Chưa đăng nhập', ...ErrorResponseJsonSchema },
          403: { description: 'Không có quyền truy cập (chỉ admin)', ...ErrorResponseJsonSchema },
          404: { description: 'Không tìm thấy mẫu', ...ErrorResponseJsonSchema },
          409: { description: 'Phiên bản đã tồn tại hoặc mẫu chưa có project nguồn', ...ErrorResponseJsonSchema },
          500: { description: 'Lỗi hệ thống', ...ErrorResponseJsonSchema },
        },
      },
    },
    async (request, reply) => {
      if (!container.publishTemplateVersionFromSource) {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống' },
        });
      }

      const parseResult = PublishVersionFromSourceRequestSchema.safeParse(
        request.body,
      );
      if (!parseResult.success) {
        const firstError = parseResult.error.issues[0];
        return reply.code(400).send({
          error: { code: 'VALIDATION_ERROR', message: firstError.message },
        });
      }

      const result = await container.publishTemplateVersionFromSource.execute({
        templateId: request.params.id,
        versionNumber: parseResult.data.versionNumber,
        changelog: parseResult.data.changelog ?? null,
      });

      if (result.success) {
        return reply.code(201).send({
          id: result.data.id,
          templateId: result.data.templateId,
          versionNumber: result.data.versionNumber,
          changelog: result.data.changelog,
          isActive: result.data.isActive,
          createdAt: result.data.createdAt.toISOString(),
        });
      }
      return reply.code(getStatusCodeForError(result.error.code)).send({
        error: result.error,
      });
    },
  );
}

/**
 * Maps error codes to HTTP status codes
 */
function getStatusCodeForError(errorCode: string): number {
  switch (errorCode) {
    case 'VALIDATION_ERROR':
    case 'INVALID_ARCHIVE':
    case 'INVALID_TEMPLATE_VERSION':
      return 400;
    case 'UNAUTHORIZED':
      return 401;
    case 'TEMPLATE_NOT_FOUND':
    case 'VERSION_NOT_FOUND':
      return 404;
    case 'TEMPLATE_IN_USE':
    case 'VERSION_EXISTS':
    case 'SOURCE_PROJECT_MISSING':
      return 409;
    case 'FILE_TOO_LARGE':
      return 413;
    case 'INTERNAL_ERROR':
    default:
      return 500;
  }
}
