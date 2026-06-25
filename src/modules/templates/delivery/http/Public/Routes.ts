import type { FastifyInstance } from 'fastify';
import type { TemplatesContainer } from '../../../Container.js';
import {
  PublicTemplateResponseJsonSchema,
  ListPublicTemplatesResponseJsonSchema,
  ErrorResponseJsonSchema,
} from './Dto.js';

/**
 * Public template routes (for authenticated users)
 */
export async function publicTemplateRoutes(app: FastifyInstance, container: TemplatesContainer) {
  // GET /api/v1/templates - list public templates
  app.get(
    '/templates',
    {
      preHandler: app.auth.verify,
      schema: {
        description: 'Lấy danh sách mẫu công khai',
        tags: ['templates'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            description: 'Lấy danh sách mẫu thành công',
            ...ListPublicTemplatesResponseJsonSchema,
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
    async (_request, reply) => {
      const result = await container.listPublicTemplates.execute();

      if (result.success) {
        return reply.code(200).send({
          templates: result.data.templates.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            category: t.category,
            isOfficial: t.isOfficial,
            createdAt: t.createdAt.toISOString(),
            updatedAt: t.updatedAt.toISOString(),
            latestVersion: t.latestVersion
              ? {
                  id: t.latestVersion.id,
                  versionNumber: t.latestVersion.versionNumber,
                  createdAt: t.latestVersion.createdAt.toISOString(),
                }
              : null,
          })),
        });
      }

      return reply.code(500).send({
        error: result.error,
      });
    },
  );

  // GET /api/v1/templates/:id - get template by id (only if active)
  app.get<{ Params: { id: string } }>(
    '/templates/:id',
    {
      preHandler: app.auth.verify,
      schema: {
        description: 'Lấy chi tiết mẫu theo ID',
        tags: ['templates'],
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
            ...PublicTemplateResponseJsonSchema,
          },
          401: {
            description: 'Chưa đăng nhập hoặc token không hợp lệ',
            ...ErrorResponseJsonSchema,
          },
          404: {
            description: 'Không tìm thấy mẫu hoặc mẫu không hoạt động',
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
      // Public detail never returns usageCount — skip the usage aggregation.
      const result = await container.getTemplateById.execute(request.params.id, {
        includeUsage: false,
      });

      if (result.success) {
        // Only return if active
        if (!result.data.isActive) {
          return reply.code(404).send({
            error: {
              code: 'TEMPLATE_NOT_FOUND',
              message: 'Không tìm thấy mẫu',
            },
          });
        }

        // Get latest version
        const versionsResult = await container.listVersionsByTemplate.execute(request.params.id);
        const latestVersion =
          versionsResult.success && versionsResult.data.versions.length > 0
            ? versionsResult.data.versions.find((v) => v.isActive)
            : null;

        return reply.code(200).send({
          id: result.data.id,
          name: result.data.name,
          description: result.data.description,
          category: result.data.category,
          isOfficial: result.data.isOfficial,
          createdAt: result.data.createdAt.toISOString(),
          updatedAt: result.data.updatedAt.toISOString(),
          latestVersion: latestVersion
            ? {
                id: latestVersion.id,
                versionNumber: latestVersion.versionNumber,
                createdAt: latestVersion.createdAt.toISOString(),
              }
            : null,
        });
      }

      return reply.code(404).send({
        error: result.error,
      });
    },
  );
}
