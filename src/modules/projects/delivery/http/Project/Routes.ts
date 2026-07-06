import type { FastifyInstance } from 'fastify';
import type { ProjectsContainer } from '../../../Container.js';
import {
  CreateProjectRequestSchema,
  UpdateProjectRequestSchema,
  ImportProjectQuerySchema,
  type CreateProjectRequestDto,
  type UpdateProjectRequestDto,
  CreateProjectBodyJsonSchema,
  UpdateProjectBodyJsonSchema,
  ProjectResponseJsonSchema,
  ProjectListResponseJsonSchema,
  ErrorResponseJsonSchema,
} from './Dto.js';

export async function projectRoutes(
  app: FastifyInstance,
  container: ProjectsContainer,
) {
  const {
    createProjectUseCase,
    getProjectUseCase,
    listProjectsUseCase,
    updateProjectUseCase,
    deleteProjectUseCase,
  } = container;

  app.get(
    '/projects',
    {
      preHandler: app.auth.verify,
      schema: {
        description: 'Lấy danh sách dự án của người dùng, sắp xếp theo cập nhật mới nhất',
        tags: ['projects'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            description: 'Lấy danh sách dự án thành công',
            ...ProjectListResponseJsonSchema,
          },
          401: {
            description: 'Chưa đăng nhập hoặc token không hợp lệ',
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
      const result = await listProjectsUseCase.execute({
        userId: request.user.sub,
        userRole: request.user.role,
      });

      if (result.success) {
        return reply.code(200).send({
          projects: result.data,
        });
      }

      const statusCode = getStatusCodeForError(result.error.code) as 200 | 401 | 500;
      return reply.status(statusCode).send({
        error: result.error,
      });
    },
  );

  app.post<{ Body: CreateProjectRequestDto }>(
    '/projects',
    {
      preHandler: app.auth.verify,
      schema: {
        description: 'Tạo dự án mới',
        tags: ['projects'],
        security: [{ bearerAuth: [] }],
        body: CreateProjectBodyJsonSchema,
        response: {
          201: {
            description: 'Tạo dự án thành công',
            ...ProjectResponseJsonSchema,
          },
          400: {
            description: 'Dữ liệu đầu vào không hợp lệ',
            ...ErrorResponseJsonSchema,
          },
          401: {
            description: 'Chưa đăng nhập hoặc token không hợp lệ',
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
      const parseResult = CreateProjectRequestSchema.safeParse(request.body);

      if (!parseResult.success) {
        const firstError = parseResult.error.issues[0];
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: firstError.message,
          },
        });
      }

      const result = await createProjectUseCase.execute({
        title: parseResult.data.title,
        category: parseResult.data.category,
        userId: request.user.sub,
        templateVersionId: parseResult.data.templateVersionId,
      });

      if (result.success) {
        return reply.code(201).send(result.data);
      }

      return reply.code(getStatusCodeForError(result.error.code)).send({
        error: result.error,
      });
    },
  );

  app.get<{ Params: { projectId: string } }>(
    '/projects/:projectId',
    {
      preHandler: app.auth.verify,
      schema: {
        description: 'Lấy chi tiết dự án theo ID',
        tags: ['projects'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['projectId'],
          properties: {
            projectId: {
              type: 'string',
              description: 'ID của dự án',
            },
          },
        },
        response: {
          200: {
            description: 'Lấy chi tiết dự án thành công',
            ...ProjectResponseJsonSchema,
          },
          401: {
            description: 'Chưa đăng nhập hoặc token không hợp lệ',
            ...ErrorResponseJsonSchema,
          },
          403: {
            description: 'Không có quyền truy cập',
            ...ErrorResponseJsonSchema,
          },
          404: {
            description: 'Không tìm thấy dự án',
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
      const result = await getProjectUseCase.execute({
        projectId: request.params.projectId,
        userId: request.user.sub,
        userRole: request.user.role,
      });

      if (result.success) {
        return reply.code(200).send(result.data);
      }

      return reply.code(getStatusCodeForError(result.error.code)).send({
        error: result.error,
      });
    },
  );

  app.put<{ Params: { projectId: string }; Body: UpdateProjectRequestDto }>(
    '/projects/:projectId',
    {
      preHandler: app.auth.verify,
      schema: {
        description: 'Cập nhật dự án',
        tags: ['projects'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['projectId'],
          properties: {
            projectId: {
              type: 'string',
              description: 'ID của dự án',
            },
          },
        },
        body: UpdateProjectBodyJsonSchema,
        response: {
          200: {
            description: 'Cập nhật dự án thành công',
            ...ProjectResponseJsonSchema,
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
            description: 'Không có quyền truy cập',
            ...ErrorResponseJsonSchema,
          },
          404: {
            description: 'Không tìm thấy dự án',
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
      const parseResult = UpdateProjectRequestSchema.safeParse(request.body);

      if (!parseResult.success) {
        const firstError = parseResult.error.issues[0];
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: firstError.message,
          },
        });
      }

      const result = await updateProjectUseCase.execute({
        projectId: request.params.projectId,
        title: parseResult.data.title,
        category: parseResult.data.category,
        userId: request.user.sub,
        userRole: request.user.role,
      });

      if (result.success) {
        return reply.code(200).send(result.data);
      }

      return reply.code(getStatusCodeForError(result.error.code)).send({
        error: result.error,
      });
    },
  );

  app.get<{ Params: { projectId: string } }>(
    '/projects/:projectId/export',
    {
      preHandler: app.auth.verify,
      schema: {
        description: 'Tải toàn bộ dự án dưới dạng .zip',
        tags: ['projects'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['projectId'],
          properties: {
            projectId: { type: 'string', description: 'ID của dự án' },
          },
        },
      },
    },
    async (request, reply) => {
      if (!container.exportProjectUseCase) {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Tính năng xuất .zip chưa sẵn sàng' },
        });
      }
      const result = await container.exportProjectUseCase.execute({
        projectId: request.params.projectId,
        userId: request.user.sub,
      });
      if (!result.success) {
        return reply
          .code(getStatusCodeForError(result.error.code))
          .send({ error: result.error });
      }
      reply.header('Content-Type', 'application/zip');
      reply.header(
        'Content-Disposition',
        buildContentDisposition(result.data.filename),
      );

      request.raw.on('close', () => {
        if (!result.data.stream.destroyed) {
          result.data.stream.destroy();
        }
      });

      return reply.send(result.data.stream);
    },
  );

  app.post<{ Querystring: { category?: string; title?: string } }>(
    '/projects/import',
    {
      preHandler: app.auth.verify,
      schema: {
        description: 'Tạo dự án mới từ tệp nén (.zip, .7z, .rar, .tar, .tar.gz)',
        tags: ['projects'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description:
                "Loại dự án: thesis | project | report | proposal | paper | presentation | other (mặc định 'other')",
            },
            title: {
              type: 'string',
              description:
                'Tên dự án (tùy chọn) — để trống sẽ lấy tên trong project.toml, rồi đến tên tệp nén, cuối cùng "Imported <ngày>"',
            },
          },
        },
        response: {
          201: {
            description: 'Tạo dự án thành công',
            ...ProjectResponseJsonSchema,
          },
          400: {
            description: 'Tệp nén hoặc loại dự án không hợp lệ',
            ...ErrorResponseJsonSchema,
          },
          401: {
            description: 'Chưa đăng nhập hoặc token không hợp lệ',
            ...ErrorResponseJsonSchema,
          },
          413: {
            description: 'Tệp nén vượt quá giới hạn',
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
      if (!container.importProjectUseCase) {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Tính năng nhập tệp nén chưa sẵn sàng' },
        });
      }

      const queryResult = ImportProjectQuerySchema.safeParse(request.query);
      if (!queryResult.success) {
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Loại dự án không hợp lệ',
          },
        });
      }

      let part;
      try {
        part = await request.file();
      } catch (err) {
        return reply.code(413).send({
          error: {
            code: 'ZIP_PAYLOAD_TOO_LARGE',
            message: 'Tệp nén vượt quá giới hạn cho phép',
          },
        });
      }
      if (!part) {
        return reply.code(400).send({
          error: { code: 'MISSING_FILE', message: 'Cần upload một tệp nén' },
        });
      }

      let archiveBuffer: Buffer;
      try {
        archiveBuffer = await part.toBuffer();
      } catch (err) {
        return reply.code(413).send({
          error: {
            code: 'ZIP_PAYLOAD_TOO_LARGE',
            message: 'Tệp nén vượt quá giới hạn cho phép',
          },
        });
      }

      const result = await container.importProjectUseCase.execute({
        userId: request.user.sub,
        archiveBuffer,
        filename: part.filename,
        category: queryResult.data.category,
        title: queryResult.data.title,
      });
      if (!result.success) {
        const status = getStatusCodeForError(result.error.code) as
          | 400
          | 401
          | 413
          | 500;
        return reply.code(status).send({ error: result.error });
      }
      return reply.code(201).send(result.data.project);
    },
  );

  app.post<{ Params: { projectId: string }; Body: { title?: string } }>(
    '/projects/:projectId/duplicate',
    {
      preHandler: app.auth.verify,
      schema: {
        description: 'Tạo bản sao của dự án (sao chép toàn bộ tệp và thiết lập)',
        tags: ['projects'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['projectId'],
          properties: {
            projectId: { type: 'string', description: 'ID của dự án nguồn' },
          },
        },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: {
              type: 'string',
              description: 'Tên cho bản sao (tùy chọn)',
            },
          },
        },
        response: {
          201: {
            description: 'Tạo bản sao thành công',
            ...ProjectResponseJsonSchema,
          },
          401: {
            description: 'Chưa đăng nhập hoặc token không hợp lệ',
            ...ErrorResponseJsonSchema,
          },
          403: {
            description: 'Không có quyền truy cập',
            ...ErrorResponseJsonSchema,
          },
          404: {
            description: 'Không tìm thấy dự án',
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
      if (!container.duplicateProjectUseCase) {
        return reply.code(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Tính năng tạo bản sao chưa sẵn sàng',
          },
        });
      }

      const result = await container.duplicateProjectUseCase.execute({
        projectId: request.params.projectId,
        userId: request.user.sub,
        title: request.body?.title,
      });

      if (result.success) {
        return reply.code(201).send(result.data.project);
      }

      return reply.code(getStatusCodeForError(result.error.code)).send({
        error: result.error,
      });
    },
  );

  app.delete<{ Params: { projectId: string } }>(
    '/projects/:projectId',
    {
      preHandler: app.auth.verify,
      schema: {
        description: 'Xóa dự án',
        tags: ['projects'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['projectId'],
          properties: {
            projectId: {
              type: 'string',
              description: 'ID của dự án',
            },
          },
        },
        response: {
          204: {
            description: 'Xóa dự án thành công',
            type: 'null',
          },
          401: {
            description: 'Chưa đăng nhập hoặc token không hợp lệ',
            ...ErrorResponseJsonSchema,
          },
          403: {
            description: 'Không có quyền truy cập',
            ...ErrorResponseJsonSchema,
          },
          404: {
            description: 'Không tìm thấy dự án',
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
      const result = await deleteProjectUseCase.execute({
        projectId: request.params.projectId,
        userId: request.user.sub,
        userRole: request.user.role,
      });

      if (result.success) {
        return reply.code(204).send();
      }

      return reply.code(getStatusCodeForError(result.error.code)).send({
        error: result.error,
      });
    },
  );
}

function buildContentDisposition(filename: string): string {
  const asciiFallback = filename
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

function getStatusCodeForError(errorCode: string): number {
  switch (errorCode) {
    case 'VALIDATION_ERROR':
    case 'INVALID_TEMPLATE_VERSION':
    case 'ZIP_PATH_TRAVERSAL':
    case 'ZIP_MALFORMED':
    case 'UNSUPPORTED_ARCHIVE':
    case 'MISSING_FILE':
      return 400;
    case 'UNAUTHORIZED':
      return 403;
    case 'PROJECT_NOT_FOUND':
      return 404;
    case 'ZIP_PAYLOAD_TOO_LARGE':
      return 413;
    case 'INTERNAL_ERROR':
    default:
      return 500;
  }
}
