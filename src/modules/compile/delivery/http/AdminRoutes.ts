/**
 * Compile module — admin routes
 *
 * Admin-only PDF download for project oversight. Registered under prefix
 * `/api/v1/admin` in app.ts. Streams the latest compiled PDF of any project;
 * no compile is triggered here.
 */

import type { FastifyInstance } from 'fastify';
import type { CompileContainer } from '../../Container.js';
import { ErrorResponseJsonSchema } from './Dto.js';
import { CompileJobError } from '../../domain/Errors.js';

export async function adminCompileRoutes(app: FastifyInstance, container: CompileContainer) {
  // GET /api/v1/admin/projects/:projectId/artifact — latest compiled PDF
  app.get<{ Params: { projectId: string } }>(
    '/projects/:projectId/artifact',
    {
      preHandler: app.auth.requireAdmin,
      schema: {
        description: 'Tải bản PDF biên dịch mới nhất của dự án (admin)',
        tags: ['admin-projects'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['projectId'],
          properties: { projectId: { type: 'string', description: 'ID của dự án' } },
        },
        response: {
          200: { description: 'File PDF', type: 'string', format: 'binary' },
          401: ErrorResponseJsonSchema,
          403: ErrorResponseJsonSchema,
          404: ErrorResponseJsonSchema,
          408: ErrorResponseJsonSchema,
          422: ErrorResponseJsonSchema,
          500: ErrorResponseJsonSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { stream, metadata } =
          await container.getLatestProjectArtifactForAdmin.execute({
            projectId: request.params.projectId,
          });

        reply
          .header('Content-Type', metadata.contentType || 'application/pdf')
          .header('Content-Length', metadata.sizeBytes)
          .header('ETag', `"${metadata.sha256}"`)
          .header(
            'Content-Disposition',
            `inline; filename="project-${request.params.projectId}.pdf"`,
          );

        request.raw.on('close', () => {
          if (!stream.destroyed) {
            stream.destroy();
          }
        });

        return reply.send(stream);
      } catch (error) {
        if (error instanceof CompileJobError) {
          return reply.code(getStatusCodeForError(error.code)).send({
            error: { code: error.code, message: error.message },
          });
        }
        throw error;
      }
    },
  );
}

function getStatusCodeForError(errorCode: string): number {
  switch (errorCode) {
    case 'COMPILE_ARTIFACT_NOT_READY':
    case 'STORAGE_NOT_FOUND':
      return 404;
    case 'COMPILE_FAILED':
      return 422;
    case 'COMPILE_TIMEOUT':
      return 408;
    default:
      return 500;
  }
}
