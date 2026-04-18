import type { FastifyInstance } from 'fastify';
import { FileRepoPrisma } from '../../../infra/FileRepoPrisma.js';
import { ProjectRepoPrisma } from '../../../../projects/infra/ProjectRepoPrisma.js';
import { ListFilesUseCase } from '../../../application/ListFilesUseCase.js';
import { GetFileUseCase } from '../../../application/GetFileUseCase.js';
import { CreateFileUseCase } from '../../../application/CreateFileUseCase.js';
import { UpdateFileUseCase } from '../../../application/UpdateFileUseCase.js';
import { RenameFileUseCase } from '../../../application/RenameFileUseCase.js';
import { DeleteFileUseCase } from '../../../application/DeleteFileUseCase.js';
import {
  CreateFileRequestSchema,
  UpdateFileRequestSchema,
  RenameFileRequestSchema,
  type CreateFileRequestDto,
  type UpdateFileRequestDto,
  type RenameFileRequestDto,
  CreateFileBodyJsonSchema,
  UpdateFileBodyJsonSchema,
  RenameFileBodyJsonSchema,
  FileResponseJsonSchema,
  FileListResponseJsonSchema,
  ErrorResponseJsonSchema,
} from './Dto.js';

/**
 * Project Files module HTTP routes
 */
export async function projectFileRoutes(app: FastifyInstance) {
  const fileRepo = new FileRepoPrisma(app.prisma);
  const projectRepo = new ProjectRepoPrisma(app.prisma);
  
  const listFilesUseCase = new ListFilesUseCase(fileRepo, projectRepo);
  const getFileUseCase = new GetFileUseCase(fileRepo, projectRepo);
  const createFileUseCase = new CreateFileUseCase(fileRepo, projectRepo);
  const updateFileUseCase = new UpdateFileUseCase(fileRepo, projectRepo);
  const renameFileUseCase = new RenameFileUseCase(fileRepo, projectRepo);
  const deleteFileUseCase = new DeleteFileUseCase(fileRepo, projectRepo);

  // GET /api/v1/projects/:projectId/files - list files
  app.get<{ Params: { projectId: string } }>(
    '/projects/:projectId/files',
    {
      preHandler: app.auth.verify,
      schema: {
        description: 'Lấy danh sách tệp trong dự án, sắp xếp theo path tăng dần',
        tags: ['project-files'],
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
            description: 'Lấy danh sách tệp thành công',
            ...FileListResponseJsonSchema,
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
      const result = await listFilesUseCase.execute({
        projectId: request.params.projectId,
        userId: request.user.sub,
        userRole: request.user.role,
      });

      if (result.success) {
        return reply.code(200).send({
          files: result.data,
        });
      }

      return reply.code(getStatusCodeForError(result.error.code)).send({
        error: result.error,
      });
    },
  );

  // POST /api/v1/projects/:projectId/files - create file
  app.post<{ Params: { projectId: string }; Body: CreateFileRequestDto }>(
    '/projects/:projectId/files',
    {
      preHandler: app.auth.verify,
      schema: {
        description: 'Tạo tệp mới trong dự án',
        tags: ['project-files'],
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
        body: CreateFileBodyJsonSchema,
        response: {
          201: {
            description: 'Tạo tệp thành công',
            ...FileResponseJsonSchema,
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
          409: {
            description: 'Tệp đã tồn tại',
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
      const parseResult = CreateFileRequestSchema.safeParse(request.body);

      if (!parseResult.success) {
        const firstError = parseResult.error.issues[0];
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: firstError.message,
          },
        });
      }

      const result = await createFileUseCase.execute({
        projectId: request.params.projectId,
        path: parseResult.data.path,
        kind: parseResult.data.kind as any,
        content: parseResult.data.content,
        mimeType: parseResult.data.mimeType,
        userId: request.user.sub,
        userRole: request.user.role,
      });

      if (result.success) {
        return reply.code(201).send({
          ...result.data,
          content: result.data.textContent,
        });
      }

      return reply.code(getStatusCodeForError(result.error.code)).send({
        error: result.error,
      });
    },
  );

  // GET /api/v1/projects/:projectId/files/* - get file by path
  app.get<{ Params: { projectId: string; '*': string } }>(
    '/projects/:projectId/files/*',
    {
      preHandler: app.auth.verify,
      schema: {
        description: 'Lấy nội dung tệp theo đường dẫn',
        tags: ['project-files'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['projectId'],
          properties: {
            projectId: {
              type: 'string',
              description: 'ID của dự án',
            },
            '*': {
              type: 'string',
              description: 'Đường dẫn tệp',
            },
          },
        },
        response: {
          200: {
            description: 'Lấy tệp thành công',
            ...FileResponseJsonSchema,
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
            description: 'Không tìm thấy tệp',
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
      const filePath = request.params['*'];

      const result = await getFileUseCase.execute({
        projectId: request.params.projectId,
        path: filePath,
        userId: request.user.sub,
        userRole: request.user.role,
      });

      if (result.success) {
        return reply.code(200).send({
          ...result.data,
          content: result.data.textContent,
        });
      }

      return reply.code(getStatusCodeForError(result.error.code)).send({
        error: result.error,
      });
    },
  );

  // PUT /api/v1/projects/:projectId/files/* - update file
  app.put<{ Params: { projectId: string; '*': string }; Body: UpdateFileRequestDto }>(
    '/projects/:projectId/files/*',
    {
      preHandler: app.auth.verify,
      schema: {
        description: 'Cập nhật nội dung tệp',
        tags: ['project-files'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['projectId'],
          properties: {
            projectId: {
              type: 'string',
              description: 'ID của dự án',
            },
            '*': {
              type: 'string',
              description: 'Đường dẫn tệp',
            },
          },
        },
        body: UpdateFileBodyJsonSchema,
        response: {
          200: {
            description: 'Cập nhật tệp thành công',
            ...FileResponseJsonSchema,
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
            description: 'Không tìm thấy tệp',
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
      const filePath = request.params['*'];
      const parseResult = UpdateFileRequestSchema.safeParse(request.body);

      if (!parseResult.success) {
        const firstError = parseResult.error.issues[0];
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: firstError.message,
          },
        });
      }

      const result = await updateFileUseCase.execute({
        projectId: request.params.projectId,
        path: filePath,
        content: parseResult.data.content,
        userId: request.user.sub,
        userRole: request.user.role,
      });

      if (result.success) {
        return reply.code(200).send({
          ...result.data,
          content: result.data.textContent,
        });
      }

      return reply.code(getStatusCodeForError(result.error.code)).send({
        error: result.error,
      });
    },
  );

  // PATCH /api/v1/projects/:projectId/files:rename - rename file (using query param for path)
  app.patch<{ Params: { projectId: string }; Querystring: { path: string }; Body: RenameFileRequestDto }>(
    '/projects/:projectId/files:rename',
    {
      preHandler: app.auth.verify,
      schema: {
        description: 'Đổi tên tệp',
        tags: ['project-files'],
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
        querystring: {
          type: 'object',
          required: ['path'],
          properties: {
            path: {
              type: 'string',
              description: 'Đường dẫn tệp hiện tại',
            },
          },
        },
        body: RenameFileBodyJsonSchema,
        response: {
          200: {
            description: 'Đổi tên tệp thành công',
            ...FileResponseJsonSchema,
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
            description: 'Không tìm thấy tệp',
            ...ErrorResponseJsonSchema,
          },
          409: {
            description: 'Tệp đã tồn tại tại đường dẫn mới',
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
      const oldPath = request.query.path;
      const parseResult = RenameFileRequestSchema.safeParse(request.body);

      if (!parseResult.success) {
        const firstError = parseResult.error.issues[0];
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: firstError.message,
          },
        });
      }

      const result = await renameFileUseCase.execute({
        projectId: request.params.projectId,
        oldPath,
        newPath: parseResult.data.newPath,
        userId: request.user.sub,
        userRole: request.user.role,
      });

      if (result.success) {
        return reply.code(200).send({
          ...result.data,
          content: result.data.textContent,
        });
      }

      return reply.code(getStatusCodeForError(result.error.code)).send({
        error: result.error,
      });
    },
  );

  // DELETE /api/v1/projects/:projectId/files/* - delete file
  app.delete<{ Params: { projectId: string; '*': string } }>(
    '/projects/:projectId/files/*',
    {
      preHandler: app.auth.verify,
      schema: {
        description: 'Xóa tệp',
        tags: ['project-files'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['projectId'],
          properties: {
            projectId: {
              type: 'string',
              description: 'ID của dự án',
            },
            '*': {
              type: 'string',
              description: 'Đường dẫn tệp',
            },
          },
        },
        response: {
          204: {
            description: 'Xóa tệp thành công',
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
            description: 'Không tìm thấy tệp',
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
      const filePath = request.params['*'];

      const result = await deleteFileUseCase.execute({
        projectId: request.params.projectId,
        path: filePath,
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
 * Maps error codes to HTTP status codes
 */
function getStatusCodeForError(errorCode: string): number {
  switch (errorCode) {
    case 'VALIDATION_ERROR':
    case 'INVALID_FILE_PATH':
      return 400;
    case 'UNAUTHORIZED':
      return 403;
    case 'FILE_NOT_FOUND':
    case 'PROJECT_NOT_FOUND':
      return 404;
    case 'FILE_ALREADY_EXISTS':
      return 409;
    case 'INTERNAL_ERROR':
    default:
      return 500;
  }
}
