/**
 * Compile module HTTP routes
 */

import type { FastifyInstance } from 'fastify';
import type { CompileContainer } from '../../Container.js';
import {
  enqueueCompileBodySchema,
  type EnqueueCompileBody,
  EnqueueCompileBodyJsonSchema,
  CompileJobResponseJsonSchema,
  ErrorResponseJsonSchema,
} from './Dto.js';
import { CompileJobError } from '../../domain/Errors.js';

export async function compileRoutes(app: FastifyInstance, container: CompileContainer) {
  // POST /api/v1/projects/:projectId/compile - enqueue compile job
  app.post<{ Params: { projectId: string }; Body: EnqueueCompileBody }>(
    '/projects/:projectId/compile',
    {
      preHandler: app.auth.verify,
      schema: {
        description: 'Tạo job biên dịch mới cho dự án',
        tags: ['compile'],
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
        body: EnqueueCompileBodyJsonSchema,
        response: {
          202: {
            description: 'Job biên dịch đã được tạo',
            type: 'object',
            required: ['job'],
            properties: {
              job: CompileJobResponseJsonSchema,
            },
          },
          400: ErrorResponseJsonSchema,
          401: ErrorResponseJsonSchema,
          403: ErrorResponseJsonSchema,
          404: ErrorResponseJsonSchema,
          500: ErrorResponseJsonSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { projectId } = request.params;
        const body = enqueueCompileBodySchema.parse(request.body ?? {});
        const userId = request.user.sub;
        const userRole = request.user.role;

        // Get main path from settings if not provided
        const entryPath = body.entryPath ?? (await container.getMainPath(projectId));

        const job = await container.enqueueCompileJob.execute({
          projectId,
          userId,
          userRole,
          entryPath,
          format: body.format ?? 'pdf',
          engine: body.engine ?? 'node',
        });

        return reply.code(202).send({ job: container.toResponse(job) });
      } catch (error) {
        if (error instanceof CompileJobError) {
          return reply.code(getStatusCodeForError(error.code)).send({
            error: {
              code: error.code,
              message: error.message,
            },
          });
        }
        throw error;
      }
    },
  );

  // GET /api/v1/projects/:projectId/compile - list compile jobs
  app.get<{ Params: { projectId: string } }>(
    '/projects/:projectId/compile',
    {
      preHandler: app.auth.verify,
      schema: {
        description: 'Lấy danh sách job biên dịch của dự án',
        tags: ['compile'],
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
            description: 'Danh sách job biên dịch',
            type: 'object',
            required: ['jobs'],
            properties: {
              jobs: {
                type: 'array',
                items: CompileJobResponseJsonSchema,
              },
            },
          },
          401: ErrorResponseJsonSchema,
          403: ErrorResponseJsonSchema,
          404: ErrorResponseJsonSchema,
          500: ErrorResponseJsonSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { projectId } = request.params;
        const userId = request.user.sub;

        const jobs = await container.listCompileJobs.execute({ projectId, userId });

        return reply.code(200).send({ jobs: jobs.map(container.toResponse) });
      } catch (error) {
        if (error instanceof CompileJobError) {
          return reply.code(getStatusCodeForError(error.code)).send({
            error: {
              code: error.code,
              message: error.message,
            },
          });
        }
        throw error;
      }
    },
  );

  // GET /api/v1/projects/:projectId/compile/:jobId - get compile job
  app.get<{ Params: { projectId: string; jobId: string } }>(
    '/projects/:projectId/compile/:jobId',
    {
      preHandler: app.auth.verify,
      schema: {
        description: 'Lấy thông tin chi tiết job biên dịch',
        tags: ['compile'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['projectId', 'jobId'],
          properties: {
            projectId: {
              type: 'string',
              description: 'ID của dự án',
            },
            jobId: {
              type: 'string',
              description: 'ID của job biên dịch',
            },
          },
        },
        response: {
          200: {
            description: 'Thông tin job biên dịch',
            type: 'object',
            required: ['job'],
            properties: {
              job: CompileJobResponseJsonSchema,
            },
          },
          401: ErrorResponseJsonSchema,
          403: ErrorResponseJsonSchema,
          404: ErrorResponseJsonSchema,
          500: ErrorResponseJsonSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { projectId, jobId } = request.params;
        const userId = request.user.sub;

        const job = await container.getCompileJob.execute({ projectId, jobId, userId });

        return reply.code(200).send({ job: container.toResponse(job) });
      } catch (error) {
        if (error instanceof CompileJobError) {
          return reply.code(getStatusCodeForError(error.code)).send({
            error: {
              code: error.code,
              message: error.message,
            },
          });
        }
        throw error;
      }
    },
  );

  // GET /api/v1/projects/:projectId/compile/:jobId/artifact - get artifact
  app.get<{ Params: { projectId: string; jobId: string } }>(
    '/projects/:projectId/compile/:jobId/artifact',
    {
      preHandler: app.auth.verify,
      schema: {
        description: 'Tải artifact (PDF) của job biên dịch',
        tags: ['compile'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['projectId', 'jobId'],
          properties: {
            projectId: {
              type: 'string',
              description: 'ID của dự án',
            },
            jobId: {
              type: 'string',
              description: 'ID của job biên dịch',
            },
          },
        },
        response: {
          200: {
            description: 'File PDF',
            type: 'string',
            format: 'binary',
          },
          401: ErrorResponseJsonSchema,
          403: ErrorResponseJsonSchema,
          404: ErrorResponseJsonSchema,
          500: ErrorResponseJsonSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { projectId, jobId } = request.params;
        const userId = request.user.sub;

        const { stream, metadata } = await container.getLatestArtifact.execute({
          projectId,
          jobId,
          userId,
        });

        reply
          .header('Content-Type', metadata.contentType)
          .header('Content-Length', metadata.sizeBytes)
          .header('ETag', `"${metadata.sha256}"`);

        return reply.send(stream);
      } catch (error) {
        if (error instanceof CompileJobError) {
          return reply.code(getStatusCodeForError(error.code)).send({
            error: {
              code: error.code,
              message: error.message,
            },
          });
        }
        throw error;
      }
    },
  );
}

function getStatusCodeForError(errorCode: string): number {
  switch (errorCode) {
    case 'INVALID_TRANSITION':
      return 400;
    case 'PROJECT_ACCESS_DENIED':
      return 403;
    case 'COMPILE_JOB_NOT_FOUND':
    case 'COMPILE_ARTIFACT_NOT_READY':
    case 'STORAGE_NOT_FOUND':
    case 'PROJECT_NOT_FOUND':
      return 404;
    case 'COMPILE_TIMEOUT':
      return 408;
    default:
      return 500;
  }
}
