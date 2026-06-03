/**
 * Capture HTTP DTOs
 *
 * Request/response validation schemas using Zod (+ OpenAPI), mirroring the
 * zotero/openalex Dto pattern (zod-to-json-schema for Fastify validation).
 *
 * Note: `save` re-resolves from url/identifier (the preview item is NOT sent
 * back) so the persisted `.bib` entry / Zotero item keep full metadata.
 */

import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

/** A creator on a captured item. */
export const CaptureCreatorDtoSchema = z.object({
  creatorType: z.string().openapi({ description: "Creator type (author, editor, ...)" }),
  firstName: z.string().optional().openapi({ description: "First name" }),
  lastName: z.string().optional().openapi({ description: "Last name" }),
  name: z.string().optional().openapi({ description: "Full name (organisations)" }),
});
export type CaptureCreatorDto = z.infer<typeof CaptureCreatorDtoSchema>;

/** A captured reference (preview shape). */
export const CaptureItemDtoSchema = z.object({
  itemType: z.string().openapi({ description: "Zotero item type" }),
  title: z.string().nullable().openapi({ description: "Title" }),
  creators: z.array(CaptureCreatorDtoSchema).openapi({ description: "Creators" }),
  date: z.string().nullable().openapi({ description: "Publication date" }),
  publicationTitle: z.string().nullable().openapi({ description: "Journal / source title" }),
  doi: z.string().nullable().openapi({ description: "DOI" }),
  url: z.string().nullable().openapi({ description: "URL" }),
  abstractNote: z.string().nullable().openapi({ description: "Abstract" }),
});
export type CaptureItemDto = z.infer<typeof CaptureItemDtoSchema>;

/** Resolve (preview) request. Exactly one of url/identifier is enforced by the use case. */
export const ResolveBodySchema = z.object({
  url: z.string().url().optional().openapi({ description: "Web page URL", example: "https://arxiv.org/abs/1706.03762" }),
  identifier: z.string().min(1).max(200).optional().openapi({ description: "DOI / PMID / arXiv ID / ISBN", example: "10.1038/nphys1170" }),
});
export type ResolveBody = z.infer<typeof ResolveBodySchema>;

export const ResolveResponseSchema = z.object({
  items: z.array(CaptureItemDtoSchema),
});
export type ResolveResponse = z.infer<typeof ResolveResponseSchema>;

/** Capture + save request. */
export const SaveCaptureBodySchema = z.object({
  url: z.string().url().optional().openapi({ description: "Web page URL" }),
  identifier: z.string().min(1).max(200).optional().openapi({ description: "DOI / PMID / arXiv ID / ISBN" }),
  targetBibPath: z
    .string()
    .regex(/\.(?:bib|ya?ml)$/, "Path must end with .bib, .yml, or .yaml")
    .optional()
    .openapi({ description: "Target bibliography file (default bibliography.bib)", example: "bibliography.bib" }),
  saveToBib: z.boolean().default(true).openapi({ description: "Append to the project .bib file" }),
  saveToZotero: z.boolean().default(false).openapi({ description: "Also write into the user's Zotero library" }),
  conflictMode: z.enum(["skip", "replace", "rename"]).optional().default("skip").openapi({ description: "How to handle .bib duplicates" }),
});
export type SaveCaptureBody = z.infer<typeof SaveCaptureBodySchema>;

export const SaveCaptureResponseSchema = z.object({
  citationKey: z.string().openapi({ description: "Citation key to insert as #cite(<key>)" }),
  bibSaved: z.boolean().openapi({ description: "Whether the .bib file was written" }),
  zoteroItemKey: z.string().nullable().openapi({ description: "New Zotero item key (if saved to library)" }),
  skippedDuplicate: z
    .object({ existingKey: z.string() })
    .nullable()
    .openapi({ description: "Set when the reference already existed in the .bib" }),
});
export type SaveCaptureResponse = z.infer<typeof SaveCaptureResponseSchema>;

export const ProjectIdParamSchema = z.object({
  projectId: z.string().openapi({ description: "Project ID" }),
});
export type ProjectIdParam = z.infer<typeof ProjectIdParamSchema>;

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

export const CaptureItemDtoJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(CaptureItemDtoSchema as any, "CaptureItemDto")
);

export const ResolveBodyJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ResolveBodySchema as any, "ResolveBody")
);

export const SaveCaptureBodyJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(SaveCaptureBodySchema as any, "SaveCaptureBody")
);

export const ProjectIdParamJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ProjectIdParamSchema as any, "ProjectIdParam")
);

export const ApiErrorJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ApiErrorSchema as any, "ApiError")
);
