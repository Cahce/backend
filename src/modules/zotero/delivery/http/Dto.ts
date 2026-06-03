/**
 * Zotero HTTP DTOs
 * 
 * Request/response validation schemas using Zod.
 */

import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

// Extend Zod with OpenAPI support
extendZodWithOpenApi(z);

/**
 * Connect Zotero Request
 *
 * libraryId/libraryType are optional. When omitted, the backend derives the
 * user's personal library from the API key via GET /keys/current.
 */
export const ConnectZoteroBodySchema = z.object({
  apiKey: z.string().min(1).max(500).openapi({
    description: "Zotero API key",
    example: "abc123xyz",
  }),
  libraryId: z.string().min(1).max(100).optional().openapi({
    description: "Zotero library ID (numeric). Omit to use the personal library.",
    example: "12345",
  }),
  libraryType: z.enum(["user", "group"]).optional().openapi({
    description: "Type of Zotero library. Omit to use the personal library.",
    example: "user",
  }),
});

export type ConnectZoteroBody = z.infer<typeof ConnectZoteroBodySchema>;

/**
 * Verify Zotero API key request (no persistence).
 */
export const VerifyZoteroBodySchema = z.object({
  apiKey: z.string().min(1).max(500).openapi({
    description: "Zotero API key",
    example: "abc123xyz",
  }),
});

export type VerifyZoteroBody = z.infer<typeof VerifyZoteroBodySchema>;

/**
 * Zotero library summary (returned by verify).
 */
export const ZoteroLibraryDtoSchema = z.object({
  id: z.string().openapi({ description: "Library ID (numeric)" }),
  name: z.string().openapi({ description: "Library name" }),
  type: z.enum(["user", "group"]).openapi({ description: "Library type" }),
});

export type ZoteroLibraryDto = z.infer<typeof ZoteroLibraryDtoSchema>;

/**
 * Verify Zotero API key response.
 */
export const VerifyZoteroResponseSchema = z.object({
  userId: z.string().openapi({ description: "Zotero user ID (numeric)" }),
  username: z.string().openapi({ description: "Zotero username" }),
  displayName: z.string().optional().openapi({ description: "Display name" }),
  libraries: z.array(ZoteroLibraryDtoSchema).openapi({
    description: "Libraries the API key can access",
  }),
});

export type VerifyZoteroResponse = z.infer<typeof VerifyZoteroResponseSchema>;

/**
 * Zotero Connection DTO
 */
export const ZoteroConnectionDtoSchema = z.object({
  id: z.string().openapi({ description: "Connection ID" }),
  libraryId: z.string().openapi({ description: "Zotero library ID" }),
  libraryType: z.enum(["user", "group"]).openapi({ description: "Library type" }),
  connectedAt: z.string().openapi({ description: "Connection timestamp (ISO 8601)" }),
  lastSyncedAt: z.string().nullable().openapi({ description: "Last sync timestamp (ISO 8601)" }),
  hasApiKey: z.literal(true).openapi({ description: "Indicates API key is stored" }),
});

export type ZoteroConnectionDto = z.infer<typeof ZoteroConnectionDtoSchema>;

/**
 * Zotero Collection DTO
 */
export const ZoteroCollectionDtoSchema = z.object({
  key: z.string().openapi({ description: "Collection key" }),
  name: z.string().openapi({ description: "Collection name" }),
  parentKey: z.string().nullable().openapi({ description: "Parent collection key (null for top-level)" }),
  numItems: z.number().openapi({ description: "Number of items in collection" }),
});

export type ZoteroCollectionDto = z.infer<typeof ZoteroCollectionDtoSchema>;

/**
 * Zotero Creator DTO
 */
export const ZoteroCreatorDtoSchema = z.object({
  creatorType: z.string().openapi({ description: "Creator type (author, editor, etc.)" }),
  firstName: z.string().optional().openapi({ description: "First name" }),
  lastName: z.string().optional().openapi({ description: "Last name" }),
  name: z.string().optional().openapi({ description: "Full name (for organizations)" }),
});

export type ZoteroCreatorDto = z.infer<typeof ZoteroCreatorDtoSchema>;

/**
 * Zotero Item DTO
 */
export const ZoteroItemDtoSchema = z.object({
  key: z.string().openapi({ description: "Item key" }),
  itemType: z.string().openapi({ description: "Item type (journalArticle, book, etc.)" }),
  title: z.string().nullable().openapi({ description: "Item title" }),
  creators: z.array(ZoteroCreatorDtoSchema).openapi({ description: "Item creators" }),
  date: z.string().nullable().openapi({ description: "Publication date" }),
  publicationTitle: z.string().nullable().openapi({ description: "Journal/publication title" }),
  doi: z.string().nullable().openapi({ description: "DOI" }),
  url: z.string().nullable().openapi({ description: "URL" }),
  abstractNote: z.string().nullable().openapi({ description: "Abstract" }),
});

export type ZoteroItemDto = z.infer<typeof ZoteroItemDtoSchema>;

/**
 * List Items Query Parameters
 */
export const ListItemsQuerySchema = z.object({
  collectionKey: z.string().optional().openapi({ description: "Filter by collection key" }),
  start: z.coerce.number().int().min(0).default(0).openapi({ description: "Pagination start" }),
  limit: z.coerce.number().int().min(1).max(100).default(100).openapi({ description: "Pagination limit" }),
  sort: z
    .enum(["dateAdded", "dateModified", "title", "creator", "date"])
    .optional()
    .openapi({ description: "Sort field (e.g. dateAdded for most recently saved)" }),
  direction: z
    .enum(["asc", "desc"])
    .optional()
    .openapi({ description: "Sort direction" }),
});

export type ListItemsQuery = z.infer<typeof ListItemsQuerySchema>;

/**
 * Sync To Bib File Request
 */
export const SyncToBibFileBodySchema = z.object({
  collectionKeys: z.array(z.string()).optional().openapi({
    description: "Collection keys to sync (optional)",
  }),
  itemKeys: z.array(z.string()).optional().openapi({
    description: "Specific item keys to sync (optional)",
  }),
  targetBibPath: z
    .string()
    .regex(
      /\.(?:bib|ya?ml)$/,
      "Path must end with .bib, .yml, or .yaml",
    )
    .openapi({
      description:
        "Target bibliography file path in project. `.bib` writes BibTeX; `.yml`/`.yaml` writes Hayagriva YAML (both supported by Typst native).",
      example: "bibliography.bib",
    }),
  syncType: z.enum(["full", "incremental"]).openapi({
    description: "Sync type",
    example: "full",
  }),
  conflictMode: z.enum(["skip", "replace", "rename"]).optional().default("skip").openapi({
    description: "How to handle bibliography conflicts",
    example: "skip",
  }),
});

export type SyncToBibFileBody = z.infer<typeof SyncToBibFileBodySchema>;

/**
 * Zotero Sync Log DTO
 */
export const ZoteroSyncLogDtoSchema = z.object({
  id: z.string().openapi({ description: "Sync log ID" }),
  syncType: z.enum(["full", "incremental"]).openapi({ description: "Sync type" }),
  status: z.enum(["pending", "running", "success", "failed"]).openapi({ description: "Sync status" }),
  itemsSynced: z.number().openapi({ description: "Number of items synced" }),
  errorMessage: z.string().nullable().openapi({ description: "Error message (if failed)" }),
  startedAt: z.string().openapi({ description: "Start timestamp (ISO 8601)" }),
  finishedAt: z.string().nullable().openapi({ description: "Finish timestamp (ISO 8601)" }),
});

export type ZoteroSyncLogDto = z.infer<typeof ZoteroSyncLogDtoSchema>;

/**
 * Project ID Path Parameter
 */
export const ProjectIdParamSchema = z.object({
  projectId: z.string().openapi({ description: "Project ID" }),
});

export type ProjectIdParam = z.infer<typeof ProjectIdParamSchema>;

/**
 * Get Sync Logs Query Parameters
 */
export const GetSyncLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50).openapi({
    description: "Maximum number of logs to return",
  }),
});

export type GetSyncLogsQuery = z.infer<typeof GetSyncLogsQuerySchema>;

/**
 * API Error Response
 */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string().openapi({ description: "Error code" }),
    message: z.string().openapi({ description: "Error message" }),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

/**
 * =========================
 * Fastify JSON Schemas
 * =========================
 * Convert Zod schemas to JSON Schema for Fastify validation
 */

import { zodToJsonSchema } from "zod-to-json-schema";

function unwrapJsonSchema(schema: unknown): Record<string, unknown> {
  const s = schema as Record<string, unknown>;
  if ("$ref" in s && "definitions" in s) {
    const refName = (s.$ref as string).replace("#/definitions/", "");
    const defs = s.definitions as Record<string, unknown>;
    return defs[refName] as Record<string, unknown>;
  }
  const { $schema, ...rest } = s;
  return rest;
}

export const ConnectZoteroBodyJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ConnectZoteroBodySchema as any, "ConnectZoteroBody")
);

export const VerifyZoteroBodyJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(VerifyZoteroBodySchema as any, "VerifyZoteroBody")
);

export const ZoteroLibraryDtoJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ZoteroLibraryDtoSchema as any, "ZoteroLibraryDto")
);

export const VerifyZoteroResponseJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(VerifyZoteroResponseSchema as any, "VerifyZoteroResponse")
);

export const ZoteroConnectionDtoJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ZoteroConnectionDtoSchema as any, "ZoteroConnectionDto")
);

export const ZoteroCollectionDtoJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ZoteroCollectionDtoSchema as any, "ZoteroCollectionDto")
);

export const ZoteroItemDtoJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ZoteroItemDtoSchema as any, "ZoteroItemDto")
);

export const ListItemsQueryJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ListItemsQuerySchema as any, "ListItemsQuery")
);

export const SyncToBibFileBodyJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(SyncToBibFileBodySchema as any, "SyncToBibFileBody")
);

export const ZoteroSyncLogDtoJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ZoteroSyncLogDtoSchema as any, "ZoteroSyncLogDto")
);

export const ProjectIdParamJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ProjectIdParamSchema as any, "ProjectIdParam")
);

export const GetSyncLogsQueryJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(GetSyncLogsQuerySchema as any, "GetSyncLogsQuery")
);

export const ApiErrorJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ApiErrorSchema as any, "ApiError")
);

