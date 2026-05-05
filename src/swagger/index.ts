import fp from "fastify-plugin";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";

export const swaggerPlugin = fp(async function swaggerPlugin(app: FastifyInstance) {
    await app.register(fastifySwagger, {
        openapi: {
            info: {
                title: "Typst Platform API",
                description: "Backend API for collaborative Typst document editing platform",
                version: "1.0.0",
            },
            servers: [
                {
                    url: "/",
                    description: "Current server",
                },
            ],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: "http",
                        scheme: "bearer",
                        bearerFormat: "JWT",
                    },
                },
            },
            tags: [
                { name: "auth", description: "Authentication endpoints" },
                { name: "projects", description: "Project management" },
                { name: "project-files", description: "Project file management" },
                { name: "project-settings", description: "Per-project settings (mainPath, compileOptions)" },
                { name: "compile", description: "Server-side Typst compilation jobs and artifacts" },
            ],
        },
    });

    await app.register(fastifySwaggerUi, {
        routePrefix: app.config.swagger.routePrefix,
        uiConfig: {
            docExpansion: "list",
            deepLinking: true,
            tryItOutEnabled: true,
        },
        staticCSP: false,
    });
});

export default swaggerPlugin;
