import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { configPlugin } from "./plugins/Config.js";
import { prismaPlugin } from "./plugins/Prisma.js";
import storagePlugin from "./plugins/Storage.js";
import { registerMultipart } from "./plugins/Multipart.js";
import { jwtPlugin } from "./plugins/JWT.js";
import { tokenCleanupPlugin } from "./plugins/TokenCleanup.js";
import { swaggerPlugin } from "./swagger/index.js";
import { healthRoutes } from "./api/health.js";
import { authRoutes } from "./modules/auth/delivery/http/Routes.js";
import { facultyRoutes } from "./modules/admin/delivery/http/Faculty/Routes.js";
import { departmentRoutes } from "./modules/admin/delivery/http/Department/Routes.js";
import { majorRoutes } from "./modules/admin/delivery/http/Major/Routes.js";
import { classRoutes } from "./modules/admin/delivery/http/Class/Routes.js";
import { teacherManagementRoutes } from "./modules/admin/delivery/http/TeacherManagement/Routes.js";
import { studentManagementRoutes } from "./modules/admin/delivery/http/StudentManagement/Routes.js";
import { accountRoutes } from "./modules/admin/delivery/http/Account/Routes.js";
import { projectRoutes } from "./modules/projects/delivery/http/Project/Routes.js";
import { projectFileRoutes } from "./modules/project-files/delivery/http/ProjectFile/Routes.js";
import { projectSettingsRoutes } from "./modules/projects/delivery/http/ProjectSettings/Routes.js";
import { ProjectsContainer } from "./modules/projects/Container.js";
import { ProjectFilesContainer } from "./modules/project-files/Container.js";
import { FileRepoPrisma } from "./modules/project-files/infra/FileRepoPrisma.js";
import { teacherProfileRoutes } from "./modules/teachers/delivery/http/Profile/Routes.js";
import { compileRoutes } from "./modules/compile/delivery/http/Routes.js";
import { buildCompileContainer } from "./modules/compile/Container.js";
import { createTemplatesContainer } from "./modules/templates/Container.js";
import { registerAdminTemplateRoutes, registerPublicTemplateRoutes } from "./modules/templates/delivery/http/Routes.js";
import { BibliographyService } from "./modules/bibliography/application/BibliographyService.js";
import { SecretCipher } from "./shared/crypto/SecretCipher.js";
import { ZoteroContainer } from "./modules/zotero/Container.js";
import { zoteroRoutes } from "./modules/zotero/delivery/http/Routes.js";
import { OpenAlexContainer } from "./modules/openalex/Container.js";
import { openalexRoutes } from "./modules/openalex/delivery/http/Routes.js";
import type { ProjectAccessPolicy } from "./modules/compile/domain/Policies.js";

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
        // HTTP server tuning for production behind a reverse proxy (Nginx/ALB).
        // - keepAliveTimeout 72s > 60s (default Nginx/ALB idle) prevents the
        //   half-closed-connection 502 race when upstream still has the socket.
        // - bodyLimit 1 MB is explicit (matches Fastify default); large
        //   binary uploads go through @fastify/multipart with its own limit
        //   configured in plugins/Multipart.ts.
        keepAliveTimeout: 72_000,
        bodyLimit: 1_048_576,
    });

    // Plugin registration order matters
    // 1. Config must be first (other plugins depend on app.config)
    await app.register(configPlugin);

    // 2. CORS (must be before routes)
    await app.register(cors, {
        origin: process.env.CORS_ORIGIN || true,
        credentials: true,
        // @fastify/cors v11 defaults to GET,HEAD,POST only — explicitly allow
        // all methods used by the project-file and project API routes.
        methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        // Browsers hide non-safelisted response headers from JS by default.
        // Binary file streams use these to ship metadata the JSON body would
        // otherwise carry (id, timestamps, storage key) — without exposing
        // them here, `response.headers.get('x-last-edited-at')` returns null
        // and the file viewer's "Last changed" row renders "—" after reload.
        exposedHeaders: [
            'X-File-Id',
            'X-Last-Edited-At',
            'X-Created-At',
            'X-Updated-At',
            'X-Storage-Key',
            'ETag',
        ],
        // Cache preflight (OPTIONS) for 24h. Browsers reuse the same preflight
        // result for subsequent same-method/same-origin requests, eliminating
        // a round trip per cross-origin call. If methods/allowedHeaders change,
        // bump backend version + ask devs to clear browser cache.
        maxAge: 86400,
    });

    // 3. Prisma (depends on app.config.db)
    await app.register(prismaPlugin);

    // 4. Storage (depends on app.config.storage)
    await app.register(storagePlugin);

    // 5. Multipart (for file uploads)
    await registerMultipart(app);

    // 6. JWT (depends on app.config.auth and app.prisma)
    await app.register(jwtPlugin);

    // 6b. Periodic cleanup of expired InvalidToken rows. Depends on JWT plugin
    //     (uses fastify-plugin's `dependencies: ['@fastify/jwt']`).
    await app.register(tokenCleanupPlugin);

    // 7. Swagger (only if enabled - generates OpenAPI spec for Postman)
    if (process.env.ENABLE_SWAGGER !== "false") {
        await app.register(swaggerPlugin);
    }

    // 8. Build containers FIRST (before routes that depend on them)
    
    // Build templates container (needed by project routes)
    const templatesContainer = createTemplatesContainer({
        prisma: app.prisma,
        templateStorageDir: app.config.templateStorage.dir,
    });
    
    // Store materialize function for projects module (typed via fastify.d.ts)
    app.decorate("materializeTemplate", templatesContainer.getMaterializeFunction());
    
    // Build compile container
    const compileContainer = buildCompileContainer(app);

    // Build projects + project-files containers. ProjectsContainer needs a
    // FileRepo (for CreateProjectUseCase); ProjectFilesContainer reuses the
    // ProjectRepo from ProjectsContainer to avoid creating duplicate repo
    // instances.
    const fileRepoForProjects = new FileRepoPrisma(app.prisma);
    const projectsContainer = new ProjectsContainer(
        app.prisma,
        fileRepoForProjects,
        app.materializeTemplate,
    );
    const projectFilesContainer = new ProjectFilesContainer(
        app.prisma,
        projectsContainer.getProjectRepo(),
    );

    // Build bibliography service (shared by Zotero and OpenAlex)
    const bibliographyService = new BibliographyService(projectFilesContainer.getFileRepo());

    // Build project access policy (shared by Zotero and OpenAlex)
    const projectAccessPolicy: ProjectAccessPolicy = {
        async requireProjectAccess(projectId: string, userId: string): Promise<void> {
            const project = await app.prisma.project.findUnique({
                where: { id: projectId },
                include: { members: true },
            });

            if (!project) {
                throw new Error("PROJECT_NOT_FOUND");
            }

            // Check if user is owner or member
            const isOwner = project.ownerId === userId;
            const isMember = project.members.some(m => m.userId === userId);

            if (!isOwner && !isMember) {
                throw new Error("PROJECT_ACCESS_DENIED");
            }
        },
    };

    // Wire binary file upload now that BlobStorage + project access policy
    // are both available. Use case is null in projectFilesContainer until this
    // call lands.
    projectFilesContainer.wireBinaryUpload(app.storage, projectAccessPolicy);

    // Same lazy-wire pattern for the zip portability flow (export + import).
    projectsContainer.wireZipPortability(app.storage, projectAccessPolicy);

    // Build Zotero container
    const secretCipher = new SecretCipher(app.config.auth.jwtSecret);
    const zoteroContainer = new ZoteroContainer(
        app.prisma as any,
        secretCipher,
        bibliographyService,
        projectAccessPolicy,
        app.config.bibliography.zoteroApiBase,
    );

    // Build OpenAlex container
    const openalexContainer = new OpenAlexContainer(
        app.prisma as any,
        bibliographyService,
        projectAccessPolicy,
        app.config.bibliography.openalexMailto,
    );

    // 9. Register routes (after containers are ready)
    await app.register(healthRoutes);
    await app.register(authRoutes, { prefix: "/api/v1/auth" });
    await app.register(facultyRoutes, { prefix: "/api/v1/admin" });
    await app.register(departmentRoutes, { prefix: "/api/v1/admin" });
    await app.register(majorRoutes, { prefix: "/api/v1/admin" });
    await app.register(classRoutes, { prefix: "/api/v1/admin" });
    await app.register(teacherManagementRoutes, { prefix: "/api/v1/admin" });
    await app.register(studentManagementRoutes, { prefix: "/api/v1/admin" });
    await app.register(accountRoutes, { prefix: "/api/v1/admin" });
    
    // Register template routes
    await app.register(async (instance) => {
        await registerAdminTemplateRoutes(instance, templatesContainer);
    }, { prefix: "/api/v1/admin" });
    await app.register(async (instance) => {
        await registerPublicTemplateRoutes(instance, templatesContainer);
    }, { prefix: "/api/v1" });
    
    // Register project routes (AFTER app.materializeTemplate is set)
    await app.register(async (instance) => {
        await projectRoutes(instance, projectsContainer);
    }, { prefix: "/api/v1" });
    await app.register(async (instance) => {
        await projectSettingsRoutes(instance, projectsContainer);
    }, { prefix: "/api/v1" });
    await app.register(async (instance) => {
        await projectFileRoutes(instance, projectFilesContainer);
    }, { prefix: "/api/v1" });
    await app.register(teacherProfileRoutes, { prefix: "/api/v1/teachers" });

    // Register compile routes
    await app.register(async (instance) => {
        await compileRoutes(instance, compileContainer);
    }, { prefix: "/api/v1" });

    // Register bibliography integration routes
    await app.register(async (instance) => {
        await zoteroRoutes(instance, zoteroContainer);
    }, { prefix: "/api/v1" });
    await app.register(async (instance) => {
        await openalexRoutes(instance, openalexContainer);
    }, { prefix: "/api/v1" });

    return app;
}
