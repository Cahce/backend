import type { FastifyInstance } from 'fastify';
import type { ProjectFilesContainer } from '../../../Container.js';
import { FileKind, type File } from '../../../domain/ProjectFile/Types.js';
import {
  isBinaryKind,
  getMimeTypeForKind,
  getExtension,
} from '../../../domain/FileKindPolicy.js';
import {
  CreateFileRequestSchema,
  UpdateFileRequestSchema,
  RenameFileRequestSchema,
  type CreateFileRequestDto,
  type UpdateFileRequestDto,
  type RenameFileRequestDto,
  type FileResponseDto,
  CreateFileBodyJsonSchema,
  UpdateFileBodyJsonSchema,
  RenameFileBodyJsonSchema,
  FileResponseJsonSchema,
  FileListResponseJsonSchema,
  ErrorResponseJsonSchema,
} from './Dto.js';

function toFileResponseDto(file: File): FileResponseDto {
  return {
    id: file.id,
    projectId: file.projectId,
    path: file.path,
    kind: file.kind,
    content: file.textContent,
    storageKey: file.storageKey,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    sha256: file.sha256,
    lastEditedAt: file.lastEditedAt ? file.lastEditedAt.toISOString() : null,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
  };
}

export async function projectFileRoutes(
  app: FastifyInstance,
  container: ProjectFilesContainer,
) {
  const {
    listFilesUseCase,
    getFileUseCase,
    createFileUseCase,
    updateFileUseCase,
    renameFileUseCase,
    deleteFileUseCase,
  } = container;

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
        kind: parseResult.data.kind as FileKind,
        content: parseResult.data.content,
        mimeType: parseResult.data.mimeType,
        userId: request.user.sub,
        userRole: request.user.role,
      });

      if (result.success) {
        return reply.code(201).send(toFileResponseDto(result.data));
      }

      return reply.code(getStatusCodeForError(result.error.code)).send({
        error: result.error,
      });
    },
  );

  app.post<{ Params: { projectId: string } }>(
    '/projects/:projectId/files:upload',
    {
      preHandler: app.auth.verify,
      schema: {
        description: 'Tải lên tệp nhị phân (ảnh, font, PDF) qua multipart/form-data',
        tags: ['project-files'],
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
        params: {
          type: 'object',
          required: ['projectId'],
          properties: {
            projectId: { type: 'string', description: 'ID của dự án' },
          },
        },
        response: {
          201: { description: 'Tải lên thành công', ...FileResponseJsonSchema },
          400: { description: 'Dữ liệu đầu vào không hợp lệ', ...ErrorResponseJsonSchema },
          401: { description: 'Chưa đăng nhập', ...ErrorResponseJsonSchema },
          403: { description: 'Không có quyền', ...ErrorResponseJsonSchema },
          404: { description: 'Không tìm thấy dự án', ...ErrorResponseJsonSchema },
          409: { description: 'Tệp đã tồn tại', ...ErrorResponseJsonSchema },
          413: { description: 'Tệp quá lớn', ...ErrorResponseJsonSchema },
          415: { description: 'Định dạng không hỗ trợ', ...ErrorResponseJsonSchema },
        },
      },
    },
    async (request, reply) => {
      const uploadUseCase = container.uploadBinaryFileUseCase;
      if (!uploadUseCase) {
        return reply.code(500).send({
          error: { code: 'UPLOAD_NOT_CONFIGURED', message: 'Binary upload chưa được cấu hình' },
        });
      }

      let fileStream: NodeJS.ReadableStream | null = null;
      let declaredMimeType = 'application/octet-stream';
      let path: string | null = null;
      let kind: FileKind | undefined;
      let fileBuffer: Buffer | null = null;

      try {
        const parts = (request as any).parts();
        for await (const part of parts) {
          if (part.type === 'file' && part.fieldname === 'file') {
            declaredMimeType = part.mimetype || 'application/octet-stream';
            if (path) {
              fileStream = part.file as NodeJS.ReadableStream;
              break;
            }
            fileBuffer = await (part as any).toBuffer();
            continue;
          }
          if (part.type === 'field') {
            if (part.fieldname === 'path') path = String(part.value);
            else if (part.fieldname === 'kind') kind = String(part.value) as FileKind;
          }
        }
        if (fileBuffer && !fileStream) {
          const { Readable } = await import('node:stream');
          fileStream = Readable.from(fileBuffer);
        }
      } catch (err: any) {
        if (err?.code === 'FST_REQ_FILE_TOO_LARGE') {
          return reply.code(413).send({
            error: { code: 'PAYLOAD_TOO_LARGE', message: 'Tệp vượt quá giới hạn cho phép' },
          });
        }
        return reply.code(400).send({
          error: { code: 'MULTIPART_PARSE_ERROR', message: err?.message ?? 'Không đọc được request' },
        });
      }

      if (!fileStream || !path) {
        return reply.code(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Thiếu trường `file` hoặc `path`' },
        });
      }

      try {
        const file = await uploadUseCase.execute({
          projectId: request.params.projectId,
          userId: request.user.sub,
          path,
          kind,
          stream: fileStream as any,
          declaredMimeType,
        });
        return reply.code(201).send(toFileResponseDto(file));
      } catch (err: any) {
        const name = err?.name ?? '';
        const message = err?.message ?? 'Upload thất bại';

        if (name === 'InvalidPathError') {
          return reply.code(400).send({ error: { code: err.code ?? 'INVALID_PATH', message } });
        }
        if (name === 'InvalidMimeError') {
          return reply.code(415).send({ error: { code: 'INVALID_MIME', message } });
        }
        if (name === 'ForbiddenExtensionError') {
          return reply.code(400).send({ error: { code: 'FORBIDDEN_EXTENSION', message } });
        }
        if (name === 'FileExistsError' || message === 'FILE_ALREADY_EXISTS') {
          return reply.code(409).send({ error: { code: 'FILE_ALREADY_EXISTS', message: 'Tệp đã tồn tại tại đường dẫn này' } });
        }
        if (name === 'ProjectAccessDeniedError') {
          return reply.code(403).send({ error: { code: 'PROJECT_FORBIDDEN', message } });
        }
        if (message.includes('PROJECT_NOT_FOUND')) {
          return reply.code(404).send({ error: { code: 'PROJECT_NOT_FOUND', message: 'Không tìm thấy project' } });
        }

        request.log.error({ err }, 'Binary upload failed');
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Đã xảy ra lỗi không mong muốn' },
        });
      }
    },
  );

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
        const file = result.data;

        if (isBinaryKind(file.kind) && file.storageKey) {
          try {
            const stream = await app.storage.get(file.storageKey);
            const ext = getExtension(file.path);
            const contentType = file.mimeType || getMimeTypeForKind(file.kind, ext);

            reply.header('Content-Type', contentType);
            if (file.sizeBytes) {
              reply.header('Content-Length', file.sizeBytes);
            }

            reply.header('X-File-Id', file.id);
            if (file.lastEditedAt) {
              reply.header('X-Last-Edited-At', file.lastEditedAt.toISOString());
            }
            reply.header('X-Created-At', file.createdAt.toISOString());
            reply.header('X-Updated-At', file.updatedAt.toISOString());
            reply.header('X-Storage-Key', file.storageKey);

            request.raw.on('close', () => {
              if (!stream.destroyed) {
                stream.destroy();
                request.log.debug(
                  { storageKey: file.storageKey, path: file.path },
                  'Download stream destroyed by client abort',
                );
              }
            });

            return reply.send(stream);
          } catch (error) {
            return reply.code(404).send({
              error: {
                code: 'STORAGE_NOT_FOUND',
                message: 'File content not found in storage',
              },
            });
          }
        }

        return reply.code(200).send(toFileResponseDto(file));
      }

      return reply.code(getStatusCodeForError(result.error.code)).send({
        error: result.error,
      });
    },
  );

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
        return reply.code(200).send(toFileResponseDto(result.data));
      }

      return reply.code(getStatusCodeForError(result.error.code)).send({
        error: result.error,
      });
    },
  );

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
        return reply.code(200).send(toFileResponseDto(result.data));
      }

      return reply.code(getStatusCodeForError(result.error.code)).send({
        error: result.error,
      });
    },
  );

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
    case 'FILE_PATH_CONFLICT':
    case 'RENAME_TARGET_EXISTS':
      return 409;
    case 'INTERNAL_ERROR':
    default:
      return 500;
  }
}
