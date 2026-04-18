import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { configPlugin } from "./plugins/Config.js";
import { prismaPlugin } from "./plugins/Prisma.js";
import { jwtPlugin } from "./plugins/JWT.js";
import { swaggerPlugin } from "./swagger/index.js";
import { healthRoutes } from "./api/health.js";
import { authRoutes } from "./modules/auth/delivery/http/Routes.js";
import { facultyRoutes } from "./modules/admin/delivery/http/Faculty/Routes.js";
import { departmentRoutes } from "./modules/admin/delivery/http/Department/Routes.js";
import { majorRoutes } from "./modules/admin/delivery/http/Major/Routes.js";
import { classRoutes } from "./modules/admin/delivery/http/Class/Routes.js";
import { teacherManagementRoutes } from "./modules/admin/delivery/http/TeacherManagement/Routes.js";
import { studentManagementRoutes } from "./modules/admin/delivery/http/StudentManagement/Routes.js";
import { projectRoutes } from "./modules/projects/delivery/http/Project/Routes.js";
import { projectFileRoutes } from "./modules/project-files/delivery/http/ProjectFile/Routes.js";

export async function buildApp(): Promise<FastifyInstance> {
    const app = Fastify({
        logger: {
            level: process.env.LOG_LEVEL || "info",
        },
        ajv: {
            customOptions: {
                // Allow OpenAPI keywords like 'example' in JSON Schema
                strict: false,
            },
        },
    });

    // Plugin registration order matters
    // 1. Config must be first (other plugins depend on app.config)
    await app.register(configPlugin);

    // 2. CORS (must be before routes)
    await app.register(cors, {
        origin: process.env.CORS_ORIGIN || true,
        credentials: true,
    });

    // 3. Prisma (depends on app.config.db)
    await app.register(prismaPlugin);

    // 4. JWT (depends on app.config.auth and app.prisma)
    await app.register(jwtPlugin);

    // 5. Swagger (only if enabled - generates OpenAPI spec for Postman)
    if (process.env.ENABLE_SWAGGER !== "false") {
        await app.register(swaggerPlugin);
    }

    // 6. Routes
    await app.register(healthRoutes);
    await app.register(authRoutes, { prefix: "/api/v1/auth" });
    await app.register(facultyRoutes, { prefix: "/api/v1/admin" });
    await app.register(departmentRoutes, { prefix: "/api/v1/admin" });
    await app.register(majorRoutes, { prefix: "/api/v1/admin" });
    await app.register(classRoutes, { prefix: "/api/v1/admin" });
    await app.register(teacherManagementRoutes, { prefix: "/api/v1/admin" });
    await app.register(studentManagementRoutes, { prefix: "/api/v1/admin" });
    await app.register(projectRoutes, { prefix: "/api/v1" });
    await app.register(projectFileRoutes, { prefix: "/api/v1" });

    return app;
}
