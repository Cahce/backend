import type { FastifyInstance } from 'fastify';
import { CreateProjectUseCase } from '../../../application/CreateProjectUseCase.js';
import { GetProjectUseCase } from '../../../application/GetProjectUseCase.js';
import { ListProjectsUseCase } from '../../../application/ListProjectsUseCase.js';
import { UpdateProjectUseCase } from '../../../application/UpdateProjectUseCase.js';
import { DeleteProjectUseCase } from '../../../application/DeleteProjectUseCase.js';
import { ProjectRepoPrisma } from '../../../infra/ProjectRepoPrisma.js';
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
export async function projectRoutes(app: FastifyInstance) {
  const projectRepo = new ProjectRepoPrisma(app.prisma);
  const createProjectUseCase = new CreateProjectUseCase(projectRepo);
  const getProjectUseCase = new GetProjectUseCase(projectRepo);
  const listProjectsUseCase = new ListProjectsUseCase(projectRepo);
  const updateProjectUseCase = new UpdateProjectUseCase(projectRepo);
  const deleteProjectUseCase = new DeleteProjectUseCase(projectRepo);

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
 * Maps error codes to HTTP status codes
 */
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
