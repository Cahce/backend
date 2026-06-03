/**
 * Bibliography HTTP DTOs.
 */

import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { zodToJsonSchema } from "zod-to-json-schema";

extendZodWithOpenApi(z);

export const DuplicateMatchReasonSchema = z.enum([
  "key",
  "doi",
  "title_author_year",
]);

export const BibEntrySchema = z.object({
  key: z.string().openapi({ description: "Citation key" }),
  type: z
    .enum([
      "article",
      "book",
      "incollection",
      "inproceedings",
      "phdthesis",
      "mastersthesis",
      "techreport",
      "misc",
    ])
    .openapi({ description: "BibTeX entry type" }),
  fields: z.record(z.string(), z.string()).default({}).openapi({
    description: "BibTeX fields",
  }),
});

export const CheckDuplicatesBodySchema = z.object({
  targetBibPath: z
    .string()
    .regex(/\.(?:bib|ya?ml)$/, "Path must end with .bib, .yml, or .yaml")
    .openapi({
      description: "Target bibliography file path in project",
      example: "bibliography.bib",
    }),
  candidates: z.array(BibEntrySchema).optional().openapi({
    description: "Optional candidate entries to compare with the target file",
  }),
  matchBy: z.array(DuplicateMatchReasonSchema).optional().openapi({
    description: "Duplicate matching strategies to apply",
  }),
});

export type CheckDuplicatesBody = z.infer<typeof CheckDuplicatesBodySchema>;

export const DuplicateEntryDtoSchema = z.object({
  key: z.string(),
  type: BibEntrySchema.shape.type,
  title: z.string().nullable(),
  author: z.string().nullable(),
  year: z.string().nullable(),
  doi: z.string().nullable(),
  index: z.number(),
  source: z.enum(["existing", "candidate"]),
});

export const DuplicateGroupDtoSchema = z.object({
  groupId: z.string(),
  reasons: z.array(DuplicateMatchReasonSchema),
  entries: z.array(DuplicateEntryDtoSchema),
});

export const CheckDuplicatesResponseSchema = z.object({
  groups: z.array(DuplicateGroupDtoSchema),
  existingCount: z.number(),
  candidateCount: z.number(),
});

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

export const CheckDuplicatesBodyJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(CheckDuplicatesBodySchema as any, "CheckDuplicatesBody")
);

export const CheckDuplicatesResponseJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(
    CheckDuplicatesResponseSchema as any,
    "CheckDuplicatesResponse"
  )
);

export const ProjectIdParamJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ProjectIdParamSchema as any, "ProjectIdParam")
);

export const ApiErrorJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ApiErrorSchema as any, "ApiError")
);
