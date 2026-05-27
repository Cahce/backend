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

/**
 * Map a domain File entity to its public HTTP response DTO. Avoids leaking
 * domain-only fields like `storageMode` and converts Date fields to ISO
 * strings explicitly instead of relying on JSON.stringify side effects.
 */
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

/**
 * Project Files module HTTP routes
 */
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

  // POST /api/v1/projects/:projectId/files:upload - multipart binary upload
  //
  // Accepts `multipart/form-data` with two parts:
  //   - `file` (required): the raw binary payload.
  //   - `path` (required): target path inside the project (e.g. "assets/logo.png").
  //   - `kind` (optional): one of FileKind; auto-detected from path if omitted.
  //
  // The JSON `POST /files` endpoint remains for text content. This endpoint is
  // additive — separating the two avoids the JSON Schema body validator from
  // tripping over multipart requests.
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
      // Buffer fallback: when the multipart sends `file` BEFORE `path` (typical
      // browser FormData serialization order), we can't break out of the loop
      // because we'd lose the path field. Instead, we consume the file part
      // into a Buffer and replay it as a Readable later. Safe because the
      // multipart plugin already enforces `MAX_UPLOAD_SIZE_BYTES`, so the
      // buffer is bounded.
      let fileBuffer: Buffer | null = null;

      try {
        const parts = (request as any).parts();
        for await (const part of parts) {
          if (part.type === 'file' && part.fieldname === 'file') {
            declaredMimeType = part.mimetype || 'application/octet-stream';
            if (path) {
              // Path already known — stream straight through, then break.
              fileStream = part.file as NodeJS.ReadableStream;
              break;
            }
            // Path not yet seen — buffer the file so the iterator can advance
            // to subsequent field parts without invalidating the stream.
            fileBuffer = await (part as any).toBuffer();
            continue;
          }
          if (part.type === 'field') {
            if (part.fieldname === 'path') path = String(part.value);
            else if (part.fieldname === 'kind') kind = String(part.value) as FileKind;
          }
        }
        // If we buffered the file (because it came before `path`), wrap the
        // buffer in a Readable so the use case sees a uniform interface.
        if (fileBuffer && !fileStream) {
          const { Readable } = await import('node:stream');
          fileStream = Readable.from(fileBuffer);
        }
      } catch (err: any) {
        // @fastify/multipart throws when fileSize limit is exceeded.
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
        const file = result.data;

        // Binary streaming for binary file kinds with storageKey
        if (isBinaryKind(file.kind) && file.storageKey) {
          try {
            const stream = await app.storage.get(file.storageKey);
            const ext = getExtension(file.path);
            const contentType = file.mimeType || getMimeTypeForKind(file.kind, ext);

            reply.header('Content-Type', contentType);
            if (file.sizeBytes) {
              reply.header('Content-Length', file.sizeBytes);
            }

            // Ship metadata via headers so the frontend can populate the file
            // viewer's "Last changed" / id / storageKey without a second
            // round-trip. The JSON response branch carries these in the body;
            // binary streams cannot, so headers are the only channel. These
            // header names are mirrored in the CORS `exposedHeaders` config
            // in app.ts — keep both lists in sync.
            reply.header('X-File-Id', file.id);
            if (file.lastEditedAt) {
              reply.header('X-Last-Edited-At', file.lastEditedAt.toISOString());
            }
            reply.header('X-Created-At', file.createdAt.toISOString());
            reply.header('X-Updated-At', file.updatedAt.toISOString());
            reply.header('X-Storage-Key', file.storageKey);

            // If the client disconnects mid-download, Fastify v5 does not
            // auto-destroy the stream sourced via `reply.send(readable)`.
            // Without this hook, backend keeps reading from disk/object
            // storage until the source EOF — wasted I/O and held file
            // descriptors. The `destroyed` guard avoids a double-destroy
            // on normal completion.
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

        // JSON response for text files
        return reply.code(200).send(toFileResponseDto(file));
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
        return reply.code(200).send(toFileResponseDto(result.data));
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
        return reply.code(200).send(toFileResponseDto(result.data));
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
    // Three semantically distinct "already exists" codes from the application
    // layer all map to HTTP 409. Keeping them separate at the domain layer
    // lets the frontend distinguish create-conflict vs rename-conflict in
    // toast messages; the status code is the same either way.
    case 'FILE_ALREADY_EXISTS':
    case 'FILE_PATH_CONFLICT':
    case 'RENAME_TARGET_EXISTS':
      return 409;
    case 'INTERNAL_ERROR':
    default:
      return 500;
  }
}
