import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { ZMSG } from "../../../../../shared/validation/ZodMessages.js";

extendZodWithOpenApi(z);

export const updateProjectSettingsSchema = z
    .object({
        baseRevision: z.number().int().positive().optional(),
        mainPath: z
            .string()
            .min(1, ZMSG.required("Đường dẫn tệp chính"))
            .refine((p) => !p.startsWith("/") && !p.includes(".."), {
                message: "Đường dẫn tệp chính không hợp lệ",
            })
            .optional()
            .openapi({
                description: "Relative path to the main Typst file",
                example: "main.typ",
            }),
        compileOptions: z
            .object({
                ppi: z.number().int().min(72).max(600).optional(),
            })
            .partial()
            .optional()
            .openapi({
                description: "Compile options for the project",
                example: { ppi: 144 },
            }),
        zoteroConfig: z
            .unknown()
            .optional()
            .openapi({
                description: "Zotero configuration for the project",
            }),
        openalexConfig: z
            .unknown()
            .optional()
            .openapi({
                description: "OpenAlex configuration for the project",
            }),
    })
    .openapi("UpdateProjectSettingsRequest");

export type UpdateProjectSettingsBody = z.infer<typeof updateProjectSettingsSchema>;

export interface ProjectSettingsResponse {
    revision: number;
    projectId: string;
    mainPath: string;
    compileOptions: Record<string, unknown>;
    zoteroConfig: Record<string, unknown> | null;
    openalexConfig: Record<string, unknown> | null;
    updatedAt: string;
}

// Documentation contracts only; existing Fastify schemas and response mapping stay authoritative.
export const projectSettingsResponseSchema = z.object({
    revision: z.number().int().positive(),
    projectId: z.string(),
    mainPath: z.string(),
    compileOptions: z.record(z.string(), z.unknown()),
    zoteroConfig: z.record(z.string(), z.unknown()).nullable(),
    openalexConfig: z.record(z.string(), z.unknown()).nullable(),
    updatedAt: z.iso.datetime(),
}).strict();
