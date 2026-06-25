/**
 * Zotero HTTP Routes
 * 
 * Fastify route handlers for Zotero integration endpoints.
 */

import type { FastifyInstance, FastifyReply } from "fastify";
import type { ZoteroContainer } from "../../Container.js";
import {
  ConnectZoteroBodyJsonSchema,
  VerifyZoteroBodyJsonSchema,
  VerifyZoteroResponseJsonSchema,
  ZoteroConnectionDtoJsonSchema,
  ZoteroCollectionDtoJsonSchema,
  ZoteroItemDtoJsonSchema,
  ListItemsQueryJsonSchema,
  SyncToBibFileBodyJsonSchema,
  ZoteroSyncLogDtoJsonSchema,
  ProjectIdParamJsonSchema,
  GetSyncLogsQueryJsonSchema,
  ApiErrorJsonSchema,
  type ConnectZoteroBody,
  type VerifyZoteroBody,
  type ListItemsQuery,
  type SyncToBibFileBody,
  type ProjectIdParam,
  type GetSyncLogsQuery,
} from "./Dto.js";
import {
  ZoteroNotConnectedError,
  ZoteroAuthError,
  ZoteroLibraryNotFoundError,
  ZoteroSyncError,
  ZoteroRateLimitError,
  ZoteroTimeoutError,
  ZoteroInvalidCredentialsError,
  ZoteroAlreadyConnectedError,
} from "../../domain/Errors.js";

/**
 * Register Zotero routes
 */
export async function zoteroRoutes(app: FastifyInstance, container: ZoteroContainer) {
  /**
   * POST /zotero/connections/verify
   * Validate a Zotero API key and return the libraries it can access.
   * Does NOT persist anything — used by the connection UI before commit.
   */
  app.post(
    "/zotero/connections/verify",
    {
      preHandler: app.auth.verify,
      schema: {
        tags: ["zotero"],
        summary: "Verify a Zotero API key",
        description:
          "Validate a Zotero API key against api.zotero.org and return the numeric user ID plus accessible libraries (personal + groups).",
        body: VerifyZoteroBodyJsonSchema,
        response: {
          200: VerifyZoteroResponseJsonSchema,
          400: ApiErrorJsonSchema,
          401: ApiErrorJsonSchema,
        },
      },
    },
    async (req, reply) => {
      try {
        const result = await container.verifyZoteroKey.execute(
          req.body as VerifyZoteroBody
        );
        return reply.send(result);
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  /**
   * POST /zotero/connections
   * Connect Zotero account
   */
  app.post(
    "/zotero/connections",
    {
      preHandler: app.auth.verify,
      schema: {
        tags: ["zotero"],
        summary: "Connect Zotero account",
        description: "Connect user's Zotero account by providing API credentials",
        body: ConnectZoteroBodyJsonSchema,
        response: {
          201: {
            type: "object",
            properties: {
              connection: ZoteroConnectionDtoJsonSchema,
            },
          },
          400: ApiErrorJsonSchema,
          401: ApiErrorJsonSchema,
          409: ApiErrorJsonSchema,
        },
      },
    },
    async (req, reply) => {
      try {
        const result = await container.connectZotero.execute({
          userId: req.user.sub,
          ...(req.body as ConnectZoteroBody),
        });

        const dto = {
          id: result.connection.id,
          libraryId: result.connection.libraryId,
          libraryType: result.connection.libraryType,
          connectedAt: result.connection.connectedAt.toISOString(),
          lastSyncedAt: result.connection.lastSyncedAt?.toISOString() || null,
          hasApiKey: true as const,
        };

        return reply.code(201).send({ connection: dto });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  /**
   * GET /zotero/connections/me
   * Get my Zotero connection
   */
  app.get(
    "/zotero/connections/me",
    {
      preHandler: app.auth.verify,
      schema: {
        tags: ["zotero"],
        summary: "Get my Zotero connection",
        description: "Retrieve current user's Zotero connection status",
        response: {
          200: {
            type: "object",
            properties: {
              connection: {
                oneOf: [
                  ZoteroConnectionDtoJsonSchema,
                  { type: "null" },
                ],
              },
            },
          },
          401: ApiErrorJsonSchema,
        },
      },
    },
    async (req, reply) => {
      try {
        const result = await container.getMyConnection.execute({
          userId: req.user.sub,
        });

        if (!result.connection) {
          return reply.send({ connection: null });
        }

        const dto = {
          id: result.connection.id,
          libraryId: result.connection.libraryId,
          libraryType: result.connection.libraryType,
          connectedAt: result.connection.connectedAt.toISOString(),
          lastSyncedAt: result.connection.lastSyncedAt?.toISOString() || null,
          hasApiKey: result.connection.hasApiKey,
        };

        return reply.send({ connection: dto });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  /**
   * DELETE /zotero/connections/me
   * Disconnect Zotero account
   */
  app.delete(
    "/zotero/connections/me",
    {
      preHandler: app.auth.verify,
      schema: {
        tags: ["zotero"],
        summary: "Disconnect Zotero account",
        description: "Disconnect current user's Zotero account",
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
            },
          },
          401: ApiErrorJsonSchema,
          404: ApiErrorJsonSchema,
        },
      },
    },
    async (req, reply) => {
      try {
        const result = await container.disconnectZotero.execute({
          userId: req.user.sub,
        });

        return reply.send({ success: result.success });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  /**
   * GET /zotero/collections
   * List Zotero collections
   */
  app.get(
    "/zotero/collections",
    {
      preHandler: app.auth.verify,
      schema: {
        tags: ["zotero"],
        summary: "List Zotero collections",
        description: "List collections from user's Zotero library",
        response: {
          200: {
            type: "object",
            properties: {
              collections: {
                type: "array",
                items: ZoteroCollectionDtoJsonSchema,
              },
            },
          },
          401: ApiErrorJsonSchema,
          404: ApiErrorJsonSchema,
        },
      },
    },
    async (req, reply) => {
      try {
        const result = await container.listCollections.execute({
          userId: req.user.sub,
        });

        const dtos = result.collections.map(c => ({
          key: c.key,
          name: c.name,
          parentKey: c.parentCollection === false ? null : (c.parentCollection || null),
          numItems: 0, // Zotero API doesn't provide this in collection list
        }));

        return reply.send({ collections: dtos });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  /**
   * GET /zotero/items
   * List Zotero items
   */
  app.get(
    "/zotero/items",
    {
      preHandler: app.auth.verify,
      schema: {
        tags: ["zotero"],
        summary: "List Zotero items",
        description: "List items from user's Zotero library or collection",
        querystring: ListItemsQueryJsonSchema,
        response: {
          200: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: ZoteroItemDtoJsonSchema,
              },
              total: { type: "number" },
            },
          },
          401: ApiErrorJsonSchema,
          404: ApiErrorJsonSchema,
        },
      },
    },
    async (req, reply) => {
      try {
        const query = req.query as ListItemsQuery;
        const result = await container.listItems.execute({
          userId: req.user.sub,
          collectionKey: query.collectionKey,
          start: query.start,
          limit: query.limit,
          sort: query.sort,
          direction: query.direction,
        });

        const dtos = result.items.map(item => ({
          key: item.key,
          itemType: item.itemType,
          title: item.title || null,
          creators: item.creators || [],
          date: item.date || null,
          publicationTitle: item.publicationTitle || null,
          doi: item.DOI || null,
          url: item.url || null,
          abstractNote: item.abstractNote || null,
        }));

        return reply.send({ items: dtos, total: result.total });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  /**
   * POST /zotero/projects/:projectId/sync
   * Sync Zotero items to project .bib file
   */
  app.post(
    "/zotero/projects/:projectId/sync",
    {
      preHandler: app.auth.verify,
      schema: {
        tags: ["zotero"],
        summary: "Sync Zotero to project",
        description: "Sync Zotero items to project's .bib file",
        params: ProjectIdParamJsonSchema,
        body: SyncToBibFileBodyJsonSchema,
        response: {
          200: {
            type: "object",
            properties: {
              syncLogId: { type: "string" },
              itemsSynced: { type: "number" },
              entries: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    zoteroItemKey: { type: "string" },
                    citationKey: { type: "string" },
                  },
                  required: ["zoteroItemKey", "citationKey"],
                },
              },
            },
            required: ["syncLogId", "itemsSynced", "entries"],
          },
          400: ApiErrorJsonSchema,
          401: ApiErrorJsonSchema,
          403: ApiErrorJsonSchema,
          404: ApiErrorJsonSchema,
        },
      },
    },
    async (req, reply) => {
      try {
        const result = await container.syncToBibFile.execute({
          userId: req.user.sub,
          projectId: (req.params as ProjectIdParam).projectId,
          ...(req.body as SyncToBibFileBody),
        });

        return reply.send(result);
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  /**
   * GET /zotero/projects/:projectId/sync-logs
   * Get sync logs for a project
   */
  app.get(
    "/zotero/projects/:projectId/sync-logs",
    {
      preHandler: app.auth.verify,
      schema: {
        tags: ["zotero"],
        summary: "Get sync logs",
        description: "Get synchronization history for a project",
        params: ProjectIdParamJsonSchema,
        querystring: GetSyncLogsQueryJsonSchema,
        response: {
          200: {
            type: "object",
            properties: {
              logs: {
                type: "array",
                items: ZoteroSyncLogDtoJsonSchema,
              },
            },
          },
          401: ApiErrorJsonSchema,
          403: ApiErrorJsonSchema,
          404: ApiErrorJsonSchema,
        },
      },
    },
    async (req, reply) => {
      try {
        const query = req.query as GetSyncLogsQuery;
        const result = await container.getSyncLogs.execute({
          userId: req.user.sub,
          projectId: (req.params as ProjectIdParam).projectId,
          limit: query.limit,
        });

        const dtos = result.logs.map(log => ({
          id: log.id,
          syncType: log.syncType,
          status: log.status,
          itemsSynced: log.itemsSynced,
          errorMessage: log.errorMessage,
          startedAt: log.startedAt.toISOString(),
          finishedAt: log.finishedAt?.toISOString() || null,
        }));

        return reply.send({ logs: dtos });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );
}

/**
 * Handle errors and map to HTTP responses
 */
function handleError(error: unknown, reply: FastifyReply) {
  if (error instanceof ZoteroNotConnectedError) {
    return reply.code(404).send({
      error: {
        code: "ZOTERO_NOT_CONNECTED",
        message: error.message,
      },
    });
  }

  if (error instanceof ZoteroAuthError) {
    return reply.code(401).send({
      error: {
        code: "ZOTERO_AUTH_FAILED",
        message: error.message,
      },
    });
  }

  if (error instanceof ZoteroLibraryNotFoundError) {
    return reply.code(404).send({
      error: {
        code: "ZOTERO_LIBRARY_NOT_FOUND",
        message: error.message,
      },
    });
  }

  if (error instanceof ZoteroAlreadyConnectedError) {
    return reply.code(409).send({
      error: {
        code: "ZOTERO_ALREADY_CONNECTED",
        message: error.message,
      },
    });
  }

  if (error instanceof ZoteroInvalidCredentialsError) {
    return reply.code(400).send({
      error: {
        code: "ZOTERO_INVALID_CREDENTIALS",
        message: error.message,
      },
    });
  }

  if (error instanceof ZoteroRateLimitError) {
    return reply.code(429).send({
      error: {
        code: "ZOTERO_RATE_LIMITED",
        message: error.message,
      },
    });
  }

  if (error instanceof ZoteroTimeoutError) {
    return reply.code(504).send({
      error: {
        code: "ZOTERO_TIMEOUT",
        message: error.message,
      },
    });
  }

  if (error instanceof ZoteroSyncError) {
    return reply.code(502).send({
      error: {
        code: "ZOTERO_SYNC_FAILED",
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
  reply.log.error({ err: error }, "Unhandled error in Zotero routes");
  return reply.code(500).send({
    error: {
      code: "INTERNAL_ERROR",
      message: "Đã xảy ra lỗi không mong muốn",
    },
  });
}

