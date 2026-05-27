import type { FastifyInstance } from 'fastify';
import type { ProjectsContainer } from '../../../Container.js';
import {
  CreateProjectRequestSchema,
  UpdateProjectRequestSchema,
  type CreateProjectRequestDto,
  type UpdateProjectRequestDto,
  CreateProjectBodyJsonSchema,
  UpdateProjectBodyJsonSchema,
  ProjectResponseJsonSchema,
  ProjectListResponseJsonSchema,
  ErrorResponseJsonSchema,
} from './Dto.js';

/**
 * Projects module HTTP routes
 */
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

  // GET /api/v1/projects - list user's projects
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

  // POST /api/v1/projects - create project
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

  // GET /api/v1/projects/:projectId - get project by id
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

  // PUT /api/v1/projects/:projectId - update project
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

  // GET /api/v1/projects/:projectId/export - download the project as a .zip
  // Streams a Buffer with `Content-Type: application/zip` and a
  // `Content-Disposition` header so the browser saves to disk directly.
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
        // No JSON-schema for binary response — keep schema minimal.
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

      // If the client disconnects mid-download, tear down the archive stream
      // so the use case stops reading from BlobStorage. Without this, archiver
      // keeps producing chunks into a closed socket and stays in memory until
      // its source files finish.
      request.raw.on('close', () => {
        if (!result.data.stream.destroyed) {
          result.data.stream.destroy();
        }
      });

      return reply.send(result.data.stream);
    },
  );

  // POST /api/v1/projects/import - create a new project from an uploaded .zip
  // Body: `multipart/form-data` with single field `file`. Cap 50 MB on the
  // compressed size; the use case caps expanded bytes too.
  app.post(
    '/projects/import',
    {
      preHandler: app.auth.verify,
      schema: {
        description: 'Tạo dự án mới từ file .zip',
        tags: ['projects'],
        security: [{ bearerAuth: [] }],
        // multipart body — schema validation handled in handler.
        response: {
          201: {
            description: 'Tạo dự án thành công',
            ...ProjectResponseJsonSchema,
          },
          400: {
            description: 'Tệp .zip không hợp lệ',
            ...ErrorResponseJsonSchema,
          },
          401: {
            description: 'Chưa đăng nhập hoặc token không hợp lệ',
            ...ErrorResponseJsonSchema,
          },
          413: {
            description: 'Tệp .zip vượt quá giới hạn',
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
          error: { code: 'INTERNAL_ERROR', message: 'Tính năng nhập .zip chưa sẵn sàng' },
        });
      }

      // Read multipart file. `@fastify/multipart` is registered globally with
      // a 50 MB file-size limit (see app.ts → registerMultipart).
      let part;
      try {
        part = await request.file();
      } catch (err) {
        // Likely a size-limit error thrown by @fastify/multipart.
        return reply.code(413).send({
          error: {
            code: 'ZIP_PAYLOAD_TOO_LARGE',
            message: 'Tệp .zip vượt quá giới hạn cho phép',
          },
        });
      }
      if (!part) {
        return reply.code(400).send({
          error: { code: 'MISSING_FILE', message: 'Cần upload một tệp .zip' },
        });
      }

      let zipBuffer: Buffer;
      try {
        zipBuffer = await part.toBuffer();
      } catch (err) {
        // Buffer assembly hit the size limit.
        return reply.code(413).send({
          error: {
            code: 'ZIP_PAYLOAD_TOO_LARGE',
            message: 'Tệp .zip vượt quá giới hạn cho phép',
          },
        });
      }

      const result = await container.importProjectUseCase.execute({
        userId: request.user.sub,
        zipBuffer,
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

  // DELETE /api/v1/projects/:projectId - delete project
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

/**
 * Build an RFC 5987 / RFC 6266 compliant Content-Disposition value.
 *
 * Vietnamese filenames (e.g. "Khóa-Luận-Tốt-Nghiệp-20260519.zip") contain
 * non-ASCII characters that cannot be placed verbatim in HTTP header values
 * — Node's HTTP serializer rejects them with `ERR_INVALID_CHAR`. The
 * standard workaround is to emit two filename parameters:
 *
 *   1. `filename="<ascii-fallback>"` for legacy clients that ignore the
 *      RFC 5987 syntax. We replace any non-ASCII byte with `_`.
 *   2. `filename*=UTF-8''<percent-encoded>` for modern browsers. They will
 *      prefer this and the user sees the original Vietnamese name.
 *
 * Reference: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Disposition
 */
function buildContentDisposition(filename: string): string {
  const asciiFallback = filename
    .replace(/[^\x20-\x7E]/g, '_')
    // Quotes inside filename= confuse the parser, strip them.
    .replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

/**
 * Maps error codes to HTTP status codes
 */
function getStatusCodeForError(errorCode: string): number {
  switch (errorCode) {
    case 'VALIDATION_ERROR':
    case 'INVALID_TEMPLATE_VERSION':
    case 'ZIP_PATH_TRAVERSAL':
    case 'ZIP_MALFORMED':
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
