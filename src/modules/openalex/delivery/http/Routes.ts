/**
 * OpenAlex HTTP Routes
 * 
 * Fastify route handlers for OpenAlex integration endpoints.
 */

import type { FastifyInstance, FastifyReply } from "fastify";
import { OpenAlexContainer } from "../../Container.js";
import type { OpenAlexWork } from "../../domain/Types.js";
import {
  SearchWorksQueryJsonSchema,
  OpenAlexWorkDtoJsonSchema,
  WorkIdParamJsonSchema,
  ImportToBibFileBodyJsonSchema,
  ImportResponseJsonSchema,
  ProjectIdParamJsonSchema,
  ApiErrorJsonSchema,
  type SearchWorksQuery,
  type WorkIdParam,
  type ImportToBibFileBody,
  type ProjectIdParam,
} from "./Dto.js";
import {
  OpenAlexNotFoundError,
  OpenAlexRateLimitError,
  OpenAlexUpstreamError,
  OpenAlexTimeoutError,
} from "../../domain/Errors.js";
import { reconstructAbstract } from "../../domain/Mapping.js";

/**
 * Register OpenAlex routes
 */
export async function openalexRoutes(app: FastifyInstance, container: OpenAlexContainer) {
  /**
   * GET /openalex/works
   * Search for works
   */
  app.get(
    "/openalex/works",
    {
      preHandler: app.auth.verify,
      schema: {
        tags: ["openalex"],
        summary: "Search OpenAlex works",
        description: "Search for academic works on OpenAlex",
        querystring: SearchWorksQueryJsonSchema,
        response: {
          200: {
            type: "object",
            properties: {
              works: {
                type: "array",
                items: OpenAlexWorkDtoJsonSchema,
              },
              total: { type: "number" },
              page: { type: "number" },
              perPage: { type: "number" },
            },
          },
          401: ApiErrorJsonSchema,
          429: ApiErrorJsonSchema,
        },
      },
    },
    async (req, reply) => {
      try {
        const result = await container.searchWorks.execute(req.query as SearchWorksQuery);

        const dtos = result.works.map(work => mapWorkToDto(work));

        return reply.send({
          works: dtos,
          total: result.total,
          page: result.page,
          perPage: result.perPage,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  /**
   * GET /openalex/works/:openAlexId
   * Get a single work by ID
   */
  app.get(
    "/openalex/works/:openAlexId",
    {
      preHandler: app.auth.verify,
      schema: {
        tags: ["openalex"],
        summary: "Get OpenAlex work by ID",
        description: "Retrieve a single work from OpenAlex",
        params: WorkIdParamJsonSchema,
        response: {
          200: {
            type: "object",
            properties: {
              work: OpenAlexWorkDtoJsonSchema,
            },
          },
          401: ApiErrorJsonSchema,
          404: ApiErrorJsonSchema,
        },
      },
    },
    async (req, reply) => {
      try {
        const result = await container.getWorkById.execute({
          id: (req.params as WorkIdParam).openAlexId,
        });

        const dto = mapWorkToDto(result.work);

        return reply.send({ work: dto });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  /**
   * POST /openalex/projects/:projectId/import
   * Import works to project .bib file
   */
  app.post(
    "/openalex/projects/:projectId/import",
    {
      preHandler: app.auth.verify,
      schema: {
        tags: ["openalex"],
        summary: "Import OpenAlex works to project",
        description: "Import OpenAlex works to project's .bib file with deduplication",
        params: ProjectIdParamJsonSchema,
        body: ImportToBibFileBodyJsonSchema,
        response: {
          200: ImportResponseJsonSchema,
          400: ApiErrorJsonSchema,
          401: ApiErrorJsonSchema,
          403: ApiErrorJsonSchema,
          404: ApiErrorJsonSchema,
        },
      },
    },
    async (req, reply) => {
      try {
        const result = await container.importToBibFile.execute({
          userId: req.user.sub,
          projectId: (req.params as ProjectIdParam).projectId,
          ...(req.body as ImportToBibFileBody),
        });

        return reply.send(result);
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );
}

/**
 * Map OpenAlex work to DTO
 */
function mapWorkToDto(work: OpenAlexWork) {
  // Extract authors
  const authors = (work.authorships || []).map((a) => ({
    name: a.author?.display_name || "Unknown",
    position: a.author_position || "unknown",
  }));

  // Reconstruct abstract
  const abstract = reconstructAbstract(work.abstract_inverted_index);

  return {
    id: work.id,
    doi: work.doi || null,
    title: work.title || work.display_name || null,
    year: work.publication_year || null,
    type: work.type || "unknown",
    authors,
    journal: work.primary_location?.source?.display_name || null,
    volume: work.biblio?.volume || null,
    issue: work.biblio?.issue || null,
    pages:
      work.biblio?.first_page && work.biblio?.last_page
        ? `${work.biblio.first_page}--${work.biblio.last_page}`
        : work.biblio?.first_page || null,
    isOA: work.open_access?.is_oa || false,
    oaUrl: work.open_access?.oa_url || null,
    landingUrl: work.primary_location?.landing_page_url || null,
    abstract: abstract || null,
    citedByCount: work.cited_by_count || 0,
  };
}

/**
 * Handle errors and map to HTTP responses
 */
function handleError(error: unknown, reply: FastifyReply) {
  if (error instanceof OpenAlexNotFoundError) {
    return reply.code(404).send({
      error: {
        code: "OPENALEX_NOT_FOUND",
        message: error.message,
      },
    });
  }

  if (error instanceof OpenAlexRateLimitError) {
    return reply.code(429).send({
      error: {
        code: "OPENALEX_RATE_LIMITED",
        message: error.message,
      },
    });
  }

  if (error instanceof OpenAlexTimeoutError) {
    return reply.code(504).send({
      error: {
        code: "OPENALEX_TIMEOUT",
        message: error.message,
      },
    });
  }

  if (error instanceof OpenAlexUpstreamError) {
    return reply.code(502).send({
      error: {
        code: "OPENALEX_UPSTREAM_ERROR",
        message: error.message,
      },
    });
  }

  // Check for project access errors
  if (error instanceof Error) {
    if (error.message.includes("PROJECT_ACCESS_DENIED") || error.message.includes("FORBIDDEN")) {
      return reply.code(403).send({
        error: {
          code: "PROJECT_FORBIDDEN",
          message: "Bạn không có quyền truy cập project này",
        },
      });
    }

    if (error.message.includes("PROJECT_NOT_FOUND")) {
      return reply.code(404).send({
        error: {
          code: "PROJECT_NOT_FOUND",
          message: "Không tìm thấy project",
        },
      });
    }
  }

  // Generic error
  reply.log.error({ err: error }, "Unhandled error in OpenAlex routes");
  return reply.code(500).send({
    error: {
      code: "INTERNAL_ERROR",
      message: "Đã xảy ra lỗi không mong muốn",
    },
  });
}

