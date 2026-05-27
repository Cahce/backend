import type { FastifyInstance } from "fastify";
import type { ProjectSettings } from "../../../domain/ProjectSettings.js";
import type { ProjectsContainer } from "../../../Container.js";
import { updateProjectSettingsSchema, type ProjectSettingsResponse } from "./Dto.js";

function toResponse(settings: ProjectSettings): ProjectSettingsResponse {
    return {
        projectId: settings.projectId,
        mainPath: settings.mainPath,
        compileOptions: settings.compileOptions,
        zoteroConfig: settings.zoteroConfig,
        updatedAt: settings.updatedAt.toISOString(),
    };
}

export async function projectSettingsRoutes(
    app: FastifyInstance,
    container: ProjectsContainer,
): Promise<void> {
    const { getProjectSettings, updateProjectSettings } = container;

    app.get<{
        Params: { projectId: string };
    }>("/projects/:projectId/settings", {
        preHandler: app.auth.verify,
        schema: {
            tags: ["project-settings"],
            summary: "Get project settings",
            params: {
                type: "object",
                properties: {
                    projectId: { type: "string" },
                },
                required: ["projectId"],
            },
            response: {
                200: {
                    description: "Project settings",
                    type: "object",
                    properties: {
                        settings: {
                            type: "object",
                            properties: {
                                projectId: { type: "string" },
                                mainPath: { type: "string" },
                                compileOptions: { type: "object" },
                                zoteroConfig: { type: ["object", "null"] },
                                updatedAt: { type: "string", format: "date-time" },
                            },
                        },
                    },
                },
            },
        },
        handler: async (req) => {
            const { projectId } = req.params;
            const userId = req.user.sub;
            const userRole = req.user.role;

            const settings = await getProjectSettings.execute({
                projectId,
                userId,
                userRole,
            });

            return { settings: toResponse(settings) };
        },
    });

    app.put<{
        Params: { projectId: string };
        Body: unknown;
    }>("/projects/:projectId/settings", {
        preHandler: app.auth.verify,
        schema: {
            tags: ["project-settings"],
            summary: "Update project settings",
            params: {
                type: "object",
                properties: {
                    projectId: { type: "string" },
                },
                required: ["projectId"],
            },
            body: {
                type: "object",
                properties: {
                    mainPath: { type: "string" },
                    compileOptions: { type: "object" },
                    zoteroConfig: { type: "object" },
                },
            },
            response: {
                200: {
                    description: "Updated project settings",
                    type: "object",
                    properties: {
                        settings: {
                            type: "object",
                            properties: {
                                projectId: { type: "string" },
                                mainPath: { type: "string" },
                                compileOptions: { type: "object" },
                                zoteroConfig: { type: ["object", "null"] },
                                updatedAt: { type: "string", format: "date-time" },
                            },
                        },
                    },
                },
            },
        },
        handler: async (req) => {
            const { projectId } = req.params;
            const userId = req.user.sub;
            const userRole = req.user.role;
            const body = updateProjectSettingsSchema.parse(req.body);

            const settings = await updateProjectSettings.execute({
                projectId,
                userId,
                userRole,
                patch: {
                    mainPath: body.mainPath,
                    compileOptions: body.compileOptions,
                    zoteroConfig: body.zoteroConfig as Record<string, unknown> | undefined,
                },
            });

            return { settings: toResponse(settings) };
        },
    });
}
