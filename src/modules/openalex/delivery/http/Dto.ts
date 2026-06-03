/**
 * OpenAlex HTTP DTOs
 * 
 * Request/response validation schemas using Zod.
 */

import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

// Extend Zod with OpenAPI support
extendZodWithOpenApi(z);

/**
 * Search Works Query Parameters
 */
export const SearchWorksQuerySchema = z.object({
  search: z.string().min(1).max(200).openapi({
    description: "Search query",
    example: "typst",
  }),
  yearFrom: z.coerce.number().int().min(1500).max(2100).optional().openapi({
    description: "Filter by publication year (from)",
  }),
  yearTo: z.coerce.number().int().min(1500).max(2100).optional().openapi({
    description: "Filter by publication year (to)",
  }),
  isOA: z.coerce.boolean().optional().openapi({
    description: "Filter by open access status",
  }),
  type: z.string().optional().openapi({
    description: "Filter by work type (journal-article, book, etc.)",
  }),
  perPage: z.coerce.number().int().min(1).max(50).default(25).openapi({
    description: "Results per page",
  }),
  page: z.coerce.number().int().min(1).default(1).openapi({
    description: "Page number",
  }),
});

export type SearchWorksQuery = z.infer<typeof SearchWorksQuerySchema>;

/**
 * OpenAlex Author DTO
 */
export const OpenAlexAuthorDtoSchema = z.object({
  name: z.string().openapi({ description: "Author name" }),
  position: z.string().openapi({ description: "Author position (first, middle, last)" }),
});

export type OpenAlexAuthorDto = z.infer<typeof OpenAlexAuthorDtoSchema>;

/**
 * OpenAlex Work DTO
 */
export const OpenAlexWorkDtoSchema = z.object({
  id: z.string().openapi({ description: "OpenAlex work ID (e.g., W12345)" }),
  doi: z.string().nullable().openapi({ description: "DOI" }),
  title: z.string().nullable().openapi({ description: "Work title" }),
  year: z.number().nullable().openapi({ description: "Publication year" }),
  type: z.string().openapi({ description: "Work type" }),
  authors: z.array(OpenAlexAuthorDtoSchema).openapi({ description: "Authors" }),
  journal: z.string().nullable().openapi({ description: "Journal/publication name" }),
  volume: z.string().nullable().openapi({ description: "Volume" }),
  issue: z.string().nullable().openapi({ description: "Issue" }),
  pages: z.string().nullable().openapi({ description: "Pages" }),
  isOA: z.boolean().openapi({ description: "Is open access" }),
  oaUrl: z.string().nullable().openapi({ description: "Open access URL" }),
  landingUrl: z.string().nullable().openapi({ description: "Landing page URL" }),
  abstract: z.string().nullable().openapi({ description: "Abstract" }),
  citedByCount: z.number().openapi({ description: "Citation count" }),
});

export type OpenAlexWorkDto = z.infer<typeof OpenAlexWorkDtoSchema>;

/**
 * Work ID Path Parameter
 */
export const WorkIdParamSchema = z.object({
  openAlexId: z.string().openapi({ description: "OpenAlex work ID" }),
});

export type WorkIdParam = z.infer<typeof WorkIdParamSchema>;

/**
 * Import To Bib File Request
 */
export const ImportToBibFileBodySchema = z.object({
  openAlexIds: z.array(z.string()).min(1).max(50).openapi({
    description: "OpenAlex work IDs to import",
    example: ["W2741809807"],
  }),
  targetBibPath: z
    .string()
    .regex(
      /\.(?:bib|ya?ml)$/,
      "Path must end with .bib, .yml, or .yaml",
    )
    .openapi({
      description:
        "Target bibliography file path in project. `.bib` writes BibTeX; `.yml`/`.yaml` writes Hayagriva YAML.",
      example: "bibliography.bib",
    }),
  conflictMode: z.enum(["skip", "replace", "rename"]).optional().default("skip").openapi({
    description: "How to handle bibliography conflicts",
    example: "skip",
  }),
});

export type ImportToBibFileBody = z.infer<typeof ImportToBibFileBodySchema>;

/**
 * Project ID Path Parameter
 */
export const ProjectIdParamSchema = z.object({
  projectId: z.string().openapi({ description: "Project ID" }),
});

export type ProjectIdParam = z.infer<typeof ProjectIdParamSchema>;

/**
 * Import Response - detailed status for each work
 */
export const ImportResponseSchema = z.object({
  imported: z.array(z.object({
    openAlexId: z.string().openapi({ description: "OpenAlex work ID" }),
    citationKey: z.string().openapi({ description: "Generated citation key" }),
  })).openapi({ description: "Successfully imported works" }),
  skippedDuplicate: z.array(z.object({
    openAlexId: z.string().openapi({ description: "OpenAlex work ID" }),
    existingKey: z.string().openapi({ description: "Existing citation key" }),
  })).openapi({ description: "Works skipped because already imported" }),
  failed: z.array(z.object({
    openAlexId: z.string().openapi({ description: "OpenAlex work ID" }),
    errorMessage: z.string().openapi({ description: "Error message" }),
  })).openapi({ description: "Works that failed to import" }),
});

export type ImportResponse = z.infer<typeof ImportResponseSchema>;

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

export const SearchWorksQueryJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(SearchWorksQuerySchema as any, "SearchWorksQuery")
);

export const OpenAlexAuthorDtoJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(OpenAlexAuthorDtoSchema as any, "OpenAlexAuthorDto")
);

export const OpenAlexWorkDtoJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(OpenAlexWorkDtoSchema as any, "OpenAlexWorkDto")
);

export const WorkIdParamJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(WorkIdParamSchema as any, "WorkIdParam")
);

export const ImportToBibFileBodyJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ImportToBibFileBodySchema as any, "ImportToBibFileBody")
);

export const ProjectIdParamJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ProjectIdParamSchema as any, "ProjectIdParam")
);

export const ImportResponseJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ImportResponseSchema as any, "ImportResponse")
);

export const ApiErrorJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ApiErrorSchema as any, "ApiError")
);
