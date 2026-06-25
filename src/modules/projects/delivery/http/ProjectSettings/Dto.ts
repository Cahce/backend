import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { ZMSG } from "../../../../../shared/validation/ZodMessages.js";

extendZodWithOpenApi(z);

export const updateProjectSettingsSchema = z
    .object({
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
    projectId: string;
    mainPath: string;
    compileOptions: Record<string, unknown>;
    zoteroConfig: Record<string, unknown> | null;
    openalexConfig: Record<string, unknown> | null;
    updatedAt: string;
}
