import type { FastifyInstance } from "fastify";
import {
  ErrorResponseJsonSchema,
  GetTeacherProfileResponseJsonSchema,
} from "./Dto.js";
import { GetTeacherProfileUseCase } from "../../../application/GetTeacherProfileUseCase.js";
import { TeacherRepository } from "../../../infra/TeacherRepository.js";

/**
 * Teacher profile routes
 */
export async function teacherProfileRoutes(app: FastifyInstance) {
  app.get(
    "/me",
    {
      preHandler: [app.auth.verify],
      schema: {
        tags: ["Teachers"],
        summary: "Get authenticated teacher's profile",
        description: "Returns the profile of the currently authenticated teacher",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            description: "Teacher profile retrieved successfully",
            ...GetTeacherProfileResponseJsonSchema,
          },
          401: {
            description: "Unauthorized or invalid token",
            ...ErrorResponseJsonSchema,
          },
          403: {
            description: "Only teachers can access this endpoint",
            ...ErrorResponseJsonSchema,
          },
          404: {
            description: "Teacher profile not found",
            ...ErrorResponseJsonSchema,
          },
        },
      },
    },
    async (request, reply) => {
      const accountId = request.user.sub;
      const userRole = request.user.role;

      // Authorization: only teachers can access this endpoint
      if (userRole !== "teacher") {
        return reply.status(403).send({
          error: {
            code: "FORBIDDEN",
            message: "Only teachers can access this endpoint",
          },
        });
      }

      // Create use case with repository
      const repository = new TeacherRepository(app.prisma);
      const useCase = new GetTeacherProfileUseCase(repository);

      // Execute use case
      const profile = await useCase.execute(accountId);

      if (!profile) {
        return reply.status(404).send({
          error: {
            code: "TEACHER_PROFILE_NOT_FOUND",
            message: "Teacher profile not found",
          },
        });
      }

      return reply.status(200).send({ teacher: profile });
    }
  );
}
