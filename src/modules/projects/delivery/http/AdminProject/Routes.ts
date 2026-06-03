import type { FastifyInstance } from 'fastify';
import type { ProjectsContainer } from '../../../Container.js';
import type { AdminProjectFilters } from '../../../domain/Project/AdminProjectPorts.js';
import {
  ListAdminProjectsQuerySchema,
  AdminProjectStatsQuerySchema,
  ListAdminProjectsQueryJsonSchema,
  AdminProjectStatsQueryJsonSchema,
  AdminProjectListResponseJsonSchema,
  AdminProjectDetailJsonSchema,
  AdminProjectStatsJsonSchema,
  ErrorResponseJsonSchema,
  type ListAdminProjectsQueryDto,
  type AdminProjectStatsQueryDto,
} from './Dto.js';

/**
 * Admin project oversight routes (admin only).
 * Registered under prefix `/api/v1/admin` in app.ts.
 */
export async function adminProjectRoutes(
  app: FastifyInstance,
  container: ProjectsContainer,
) {
  // GET /api/v1/admin/projects/stats — declared BEFORE the dynamic
  // `/projects/:projectId` route so the literal segment is unambiguous.
  app.get<{ Querystring: AdminProjectStatsQueryDto }>(
    '/projects/stats',
    {
      preHandler: app.auth.requireAdmin,
      schema: {
        description: 'Thống kê tổng hợp dự án (admin)',
        tags: ['admin-projects'],
        security: [{ bearerAuth: [] }],
        querystring: AdminProjectStatsQueryJsonSchema,
        response: {
          200: AdminProjectStatsJsonSchema,
          400: ErrorResponseJsonSchema,
          401: ErrorResponseJsonSchema,
          403: ErrorResponseJsonSchema,
          500: ErrorResponseJsonSchema,
        },
      },
    },
    async (request, reply) => {
      const parsed = AdminProjectStatsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
        });
      }
      const result = await container.getAdminProjectStatsUseCase.execute(
        parsed.data.ownerRole,
      );
      if (result.success) return reply.code(200).send(result.data);
      return reply
        .code(getStatusCodeForError(result.error.code))
        .send({ error: result.error });
    },
  );

  // GET /api/v1/admin/projects — list all projects with filters
  app.get<{ Querystring: ListAdminProjectsQueryDto }>(
    '/projects',
    {
      preHandler: app.auth.requireAdmin,
      schema: {
        description: 'Danh sách tất cả dự án của sinh viên/giảng viên (admin)',
        tags: ['admin-projects'],
        security: [{ bearerAuth: [] }],
        querystring: ListAdminProjectsQueryJsonSchema,
        response: {
          200: AdminProjectListResponseJsonSchema,
          400: ErrorResponseJsonSchema,
          401: ErrorResponseJsonSchema,
          403: ErrorResponseJsonSchema,
          500: ErrorResponseJsonSchema,
        },
      },
    },
    async (request, reply) => {
      const parsed = ListAdminProjectsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
        });
      }
      const q = parsed.data;
      const filters: AdminProjectFilters = {
        ownerRole: q.ownerRole,
        category: q.category,
        search: q.search || undefined,
        facultyId: q.facultyId || undefined,
        majorId: q.majorId || undefined,
        classId: q.classId || undefined,
        departmentId: q.departmentId || undefined,
        createdFrom: q.createdFrom ? new Date(q.createdFrom) : undefined,
        createdTo: q.createdTo ? new Date(q.createdTo) : undefined,
        updatedFrom: q.updatedFrom ? new Date(q.updatedFrom) : undefined,
        updatedTo: q.updatedTo ? new Date(q.updatedTo) : undefined,
        sort: q.sort,
        order: q.order,
        page: q.page,
        pageSize: q.pageSize,
      };
      const result = await container.listAdminProjectsUseCase.execute(filters);
      if (result.success) return reply.code(200).send(result.data);
      return reply
        .code(getStatusCodeForError(result.error.code))
        .send({ error: result.error });
    },
  );

  // GET /api/v1/admin/projects/:projectId — detail
  app.get<{ Params: { projectId: string } }>(
    '/projects/:projectId',
    {
      preHandler: app.auth.requireAdmin,
      schema: {
        description: 'Chi tiết một dự án (admin)',
        tags: ['admin-projects'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['projectId'],
          properties: { projectId: { type: 'string' } },
        },
        response: {
          200: AdminProjectDetailJsonSchema,
          401: ErrorResponseJsonSchema,
          403: ErrorResponseJsonSchema,
          404: ErrorResponseJsonSchema,
          500: ErrorResponseJsonSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await container.getAdminProjectDetailUseCase.execute(
        request.params.projectId,
      );
      if (result.success) return reply.code(200).send(result.data);
      return reply
        .code(getStatusCodeForError(result.error.code))
        .send({ error: result.error });
    },
  );

  // GET /api/v1/admin/projects/:projectId/export — download .zip (admin bypass)
  app.get<{ Params: { projectId: string } }>(
    '/projects/:projectId/export',
    {
      preHandler: app.auth.requireAdmin,
      schema: {
        description: 'Tải mã nguồn dự án (.zip) — admin',
        tags: ['admin-projects'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['projectId'],
          properties: { projectId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      if (!container.adminExportProjectUseCase) {
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Tính năng xuất .zip chưa sẵn sàng' },
        });
      }
      const result = await container.adminExportProjectUseCase.execute({
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
}

/**
 * RFC 5987 / 6266 Content-Disposition (handles Vietnamese filenames).
 * Mirrors the helper in Project/Routes.ts.
 */
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
      return 400;
    case 'UNAUTHORIZED':
      return 403;
    case 'PROJECT_NOT_FOUND':
      return 404;
    case 'INTERNAL_ERROR':
    default:
      return 500;
  }
}
