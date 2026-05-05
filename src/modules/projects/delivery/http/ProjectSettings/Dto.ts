import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const updateProjectSettingsSchema = z
    .object({
        mainPath: z
            .string()
            .min(1)
            .refine((p) => !p.startsWith("/") && !p.includes(".."), {
                message: "INVALID_MAIN_PATH",
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
    })
    .openapi("UpdateProjectSettingsRequest");

export type UpdateProjectSettingsBody = z.infer<typeof updateProjectSettingsSchema>;

export interface ProjectSettingsResponse {
    projectId: string;
    mainPath: string;
    compileOptions: Record<string, unknown>;
    zoteroConfig: Record<string, unknown> | null;
    updatedAt: string;
}
