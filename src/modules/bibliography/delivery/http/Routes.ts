/**
 * Bibliography HTTP routes.
 */

import type { FastifyInstance, FastifyReply } from "fastify";
import type { BibliographyContainer } from "../../Container.js";
import {
  ApiErrorJsonSchema,
  CheckDuplicatesBodyJsonSchema,
  CheckDuplicatesResponseJsonSchema,
  ProjectIdParamJsonSchema,
  type CheckDuplicatesBody,
  type ProjectIdParam,
} from "./Dto.js";

export async function bibliographyRoutes(
  app: FastifyInstance,
  container: BibliographyContainer
) {
  app.post(
    "/bibliography/projects/:projectId/check-duplicates",
    {
      preHandler: app.auth.verify,
      schema: {
        tags: ["bibliography"],
        summary: "Check bibliography duplicates",
        description:
          "Analyze a project bibliography file and optional candidate entries without mutating project files.",
        params: ProjectIdParamJsonSchema,
        body: CheckDuplicatesBodyJsonSchema,
        response: {
          200: CheckDuplicatesResponseJsonSchema,
          400: ApiErrorJsonSchema,
          401: ApiErrorJsonSchema,
          403: ApiErrorJsonSchema,
          404: ApiErrorJsonSchema,
        },
      },
    },
    async (req, reply) => {
      try {
        const result = await container.checkDuplicates.execute({
          userId: req.user.sub,
          projectId: (req.params as ProjectIdParam).projectId,
          ...(req.body as CheckDuplicatesBody),
        });

        return reply.send(result);
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );
}

function handleError(error: unknown, reply: FastifyReply) {
  if (error instanceof Error) {
    if (error.message.includes("PROJECT_ACCESS_DENIED") || error.message.includes("FORBIDDEN")) {
      return reply.code(403).send({
        error: {
          code: "PROJECT_FORBIDDEN",
          message: "Ban khong co quyen truy cap project nay",
        },
      });
    }

    if (error.message.includes("PROJECT_NOT_FOUND")) {
      return reply.code(404).send({
        error: {
          code: "PROJECT_NOT_FOUND",
          message: "Khong tim thay project",
        },
      });
    }

    if (error.message.includes("Unsupported bibliography format")) {
      return reply.code(400).send({
        error: {
          code: "UNSUPPORTED_BIBLIOGRAPHY_FORMAT",
          message: error.message,
        },
      });
    }
  }

  reply.log.error({ err: error }, "Unhandled error in Bibliography routes");
  return reply.code(500).send({
    error: {
      code: "INTERNAL_ERROR",
      message: "Da xay ra loi khong mong muon",
    },
  });
}
