/**
 * Capture HTTP Routes
 *
 * Fastify routes for the "capture a paper from the web → cite into project"
 * flow. All routes require auth; the save route enforces project access via
 * the use case's ProjectAccessPolicy.
 */

import type { FastifyInstance, FastifyReply } from "fastify";
import type { CaptureContainer } from "../../Container.js";
import type { CaptureItem } from "../../domain/Types.js";
import {
  ResolveBodyJsonSchema,
  SaveCaptureBodyJsonSchema,
  CaptureItemDtoJsonSchema,
  ProjectIdParamJsonSchema,
  ApiErrorJsonSchema,
  type ResolveBody,
  type SaveCaptureBody,
  type ProjectIdParam,
} from "./Dto.js";
import {
  TranslationUnavailableError,
  TranslationNoResultError,
  CaptureInvalidInputError,
} from "../../domain/Errors.js";
import { UnsafeUrlError } from "../../domain/UrlSafety.js";
import {
  ZoteroNotConnectedError,
  ZoteroWriteForbiddenError,
  ZoteroAuthError,
  ZoteroRateLimitError,
  ZoteroSyncError,
} from "../../../zotero/domain/Errors.js";

export async function captureRoutes(
  app: FastifyInstance,
  container: CaptureContainer
) {
  /**
   * POST /capture/resolve
   * Preview metadata for a URL or identifier (no persistence).
   */
  app.post(
    "/capture/resolve",
    {
      preHandler: app.auth.verify,
      schema: {
        tags: ["capture"],
        summary: "Resolve reference metadata (preview)",
        description:
          "Extract clean citation metadata for a web page URL or an identifier (DOI/PMID/arXiv/ISBN) via the Zotero translation-server. Does not write anything.",
        body: ResolveBodyJsonSchema,
        response: {
          200: {
            type: "object",
            properties: {
              items: { type: "array", items: CaptureItemDtoJsonSchema },
            },
            required: ["items"],
          },
          400: ApiErrorJsonSchema,
          401: ApiErrorJsonSchema,
          422: ApiErrorJsonSchema,
          502: ApiErrorJsonSchema,
        },
      },
    },
    async (req, reply) => {
      try {
        const result = await container.resolveReference.execute(
          req.body as ResolveBody
        );
        return reply.send({ items: result.items.map(mapItemToDto) });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  /**
   * POST /capture/projects/:projectId/save
   * Resolve + save to project .bib and/or the user's Zotero library.
   */
  app.post(
    "/capture/projects/:projectId/save",
    {
      preHandler: app.auth.verify,
      schema: {
        tags: ["capture"],
        summary: "Capture a reference into a project",
        description:
          "Resolve a URL/identifier and save it to the project's .bib file and/or the user's Zotero library, returning a citation key to insert as #cite(<key>).",
        params: ProjectIdParamJsonSchema,
        body: SaveCaptureBodyJsonSchema,
        response: {
          200: {
            type: "object",
            properties: {
              citationKey: { type: "string" },
              bibSaved: { type: "boolean" },
              zoteroItemKey: { type: ["string", "null"] },
              skippedDuplicate: {
                type: ["object", "null"],
                properties: { existingKey: { type: "string" } },
              },
            },
            required: ["citationKey", "bibSaved"],
          },
          400: ApiErrorJsonSchema,
          401: ApiErrorJsonSchema,
          403: ApiErrorJsonSchema,
          404: ApiErrorJsonSchema,
          422: ApiErrorJsonSchema,
          429: ApiErrorJsonSchema,
          502: ApiErrorJsonSchema,
        },
      },
    },
    async (req, reply) => {
      try {
        const body = req.body as SaveCaptureBody;
        const result = await container.captureToProject.execute({
          userId: req.user.sub,
          projectId: (req.params as ProjectIdParam).projectId,
          url: body.url,
          identifier: body.identifier,
          targetBibPath: body.targetBibPath ?? "bibliography.bib",
          saveToBib: body.saveToBib,
          saveToZotero: body.saveToZotero,
          conflictMode: body.conflictMode,
        });
        return reply.send(result);
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );
}

/** Map a domain item to the preview DTO (DOI → doi, drop noisy fields). */
function mapItemToDto(item: CaptureItem) {
  return {
    itemType: item.itemType,
    title: item.title ?? null,
    creators: (item.creators ?? []).map((c) => ({
      creatorType: c.creatorType,
      firstName: c.firstName,
      lastName: c.lastName,
      name: c.name,
    })),
    date: item.date ?? null,
    publicationTitle: item.publicationTitle ?? null,
    doi: item.DOI ?? null,
    url: item.url ?? null,
    abstractNote: item.abstractNote ?? null,
  };
}

function handleError(error: unknown, reply: FastifyReply) {
  if (error instanceof CaptureInvalidInputError || error instanceof UnsafeUrlError) {
    return reply.code(400).send({
      error: { code: "CAPTURE_INVALID_INPUT", message: error.message },
    });
  }

  if (error instanceof TranslationNoResultError) {
    return reply.code(422).send({
      error: { code: "TRANSLATION_NO_RESULT", message: error.message },
    });
  }

  if (error instanceof TranslationUnavailableError) {
    return reply.code(502).send({
      error: { code: "TRANSLATION_UNAVAILABLE", message: error.message },
    });
  }

  if (error instanceof ZoteroNotConnectedError) {
    return reply.code(404).send({
      error: { code: "ZOTERO_NOT_CONNECTED", message: error.message },
    });
  }

  if (error instanceof ZoteroWriteForbiddenError) {
    return reply.code(403).send({
      error: { code: "ZOTERO_WRITE_FORBIDDEN", message: error.message },
    });
  }

  if (error instanceof ZoteroAuthError) {
    return reply.code(401).send({
      error: { code: "ZOTERO_AUTH_FAILED", message: error.message },
    });
  }

  if (error instanceof ZoteroRateLimitError) {
    return reply.code(429).send({
      error: { code: "ZOTERO_RATE_LIMITED", message: error.message },
    });
  }

  if (error instanceof ZoteroSyncError) {
    return reply.code(502).send({
      error: { code: "ZOTERO_SYNC_FAILED", message: error.message },
    });
  }

  if (error instanceof Error) {
    if (
      error.message.includes("PROJECT_ACCESS_DENIED") ||
      error.message.includes("FORBIDDEN")
    ) {
      return reply.code(403).send({
        error: {
          code: "PROJECT_FORBIDDEN",
          message: "Bạn không có quyền truy cập project này",
        },
      });
    }
    if (error.message.includes("PROJECT_NOT_FOUND")) {
      return reply.code(404).send({
        error: { code: "PROJECT_NOT_FOUND", message: "Không tìm thấy project" },
      });
    }
  }

  reply.log.error({ err: error }, "Unhandled error in Capture routes");
  return reply.code(500).send({
    error: {
      code: "INTERNAL_ERROR",
      message: "Đã xảy ra lỗi không mong muốn",
    },
  });
}
