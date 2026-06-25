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
import { adminProjectRoutes } from "./modules/projects/delivery/http/AdminProject/Routes.js";
import { adminCompileRoutes } from "./modules/compile/delivery/http/AdminRoutes.js";
import { projectFileRoutes } from "./modules/project-files/delivery/http/ProjectFile/Routes.js";
import { projectSettingsRoutes } from "./modules/projects/delivery/http/ProjectSettings/Routes.js";
import { ProjectsContainer } from "./modules/projects/Container.js";
import { ProjectFilesContainer } from "./modules/project-files/Container.js";
import { FileRepoPrisma } from "./modules/project-files/infra/FileRepoPrisma.js";
import { PrismaProjectAccessRepository } from "./modules/projects/infra/PrismaProjectAccessRepository.js";
import { teacherProfileRoutes } from "./modules/teachers/delivery/http/Profile/Routes.js";
import { compileRoutes } from "./modules/compile/delivery/http/Routes.js";
import { buildCompileContainer } from "./modules/compile/Container.js";
import { createTemplatesContainer } from "./modules/templates/Container.js";
import type { SourceProjectGateway } from "./modules/templates/domain/Ports.js";
import { registerAdminTemplateRoutes, registerPublicTemplateRoutes } from "./modules/templates/delivery/http/Routes.js";
import { BibliographyService } from "./modules/bibliography/application/BibliographyService.js";
import { BibliographyContainer } from "./modules/bibliography/Container.js";
import { bibliographyRoutes } from "./modules/bibliography/delivery/http/Routes.js";
import { SecretCipher } from "./shared/crypto/SecretCipher.js";
import { ZoteroContainer } from "./modules/zotero/Container.js";
import { zoteroRoutes } from "./modules/zotero/delivery/http/Routes.js";
import { OpenAlexContainer } from "./modules/openalex/Container.js";
import { openalexRoutes } from "./modules/openalex/delivery/http/Routes.js";
import { CaptureContainer } from "./modules/capture/Container.js";
import { captureRoutes } from "./modules/capture/delivery/http/Routes.js";
import type { LibraryWriterPort } from "./modules/capture/domain/Ports.js";
import { OpenAlexApiClient } from "./modules/openalex/infra/OpenAlexApiClient.js";
import { OpenAlexIdentifierFallback } from "./modules/capture/infra/OpenAlexIdentifierFallback.js";
import type { ProjectAccessPolicy, ProjectWriteAccessPolicy } from "./modules/projects/domain/access/ProjectAccessPolicies.js";
import { toErrorResponse, errorEnvelope } from "./shared/http/domainError.js";

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

    // Global error handler — guarantees every uncaught error returns the
    // standard `{ error: { code, message } }` envelope with a Vietnamese
    // message, instead of leaking Fastify's default 500/English shape.
    //
    // - Zod `.parse()` throws → 400 VALIDATION_ERROR + first issue message
    //   (this is what made the admin Account route return a raw 500 before).
    // - Fastify JSON-schema (ajv) validation → 400 VALIDATION_ERROR.
    // - Known domain error codes → their mapped status.
    // - Other framework 4xx (413 payload too large, 415, malformed JSON) →
    //   preserve the status with a Vietnamese message.
    // - Anything else → 500 INTERNAL_ERROR (logged).
    // Auth (401/403) is replied directly inside JWT.ts and never reaches here.
    const MESSAGE_BY_STATUS: Record<number, string> = {
        400: "Dữ liệu không hợp lệ",
        404: "Không tìm thấy tài nguyên",
        413: "Tệp tải lên vượt quá giới hạn cho phép",
        415: "Định dạng tệp không được hỗ trợ",
    };
    app.setErrorHandler((err, req, reply) => {
        const fastifyErr = err as { statusCode?: number; validation?: unknown };

        // Fastify schema (ajv) validation failures carry a `validation` array and
        // an English message — normalize to our Vietnamese envelope.
        if (fastifyErr.validation != null) {
            return reply.code(400).send(errorEnvelope("VALIDATION_ERROR"));
        }

        const mapped = toErrorResponse(err);
        if (mapped.status !== 500) {
            return reply.code(mapped.status).send(mapped.body);
        }

        // toErrorResponse couldn't classify it. Respect a framework-provided 4xx.
        const sc = fastifyErr.statusCode;
        if (typeof sc === "number" && sc >= 400 && sc < 500) {
            return reply
                .code(sc)
                .send(errorEnvelope("HTTP_ERROR", MESSAGE_BY_STATUS[sc]));
        }

        req.log.error({ err }, "Unhandled error");
        return reply.code(500).send(errorEnvelope("INTERNAL_ERROR"));
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

    // Build project access policy (shared by binary upload, Zotero, OpenAlex,
    // Capture, and zip export) — owner-or-member read + owner-or-editor write.
    // Implemented in projects/infra so the composition root stays query-free.
    const projectAccessPolicy: ProjectAccessPolicy & ProjectWriteAccessPolicy =
        new PrismaProjectAccessRepository(app.prisma);

    // Wire binary file upload now that BlobStorage + project access policy
    // are both available. Use case is null in projectFilesContainer until this
    // call lands.
    projectFilesContainer.wireBinaryUpload(app.storage, projectAccessPolicy);

    // Same lazy-wire pattern for the zip portability flow (export + import).
    projectsContainer.wireZipPortability(app.storage, projectAccessPolicy);

    // Wire template "source project" authoring: lets the templates module
    // author content inside a real admin-owned project (reusing projects +
    // project-files) and publish versions from it. Composed here because the
    // gateway depends on the projects/project-files containers built above.
    const sourceProjectGateway: SourceProjectGateway = {
        async createSourceProject({ title, category, ownerId, templateVersionId }) {
            const result = await projectsContainer.createProjectUseCase.execute({
                title,
                category,
                userId: ownerId,
                templateVersionId: templateVersionId ?? undefined,
            });
            if (!result.success) {
                throw Object.assign(new Error(result.error.message), {
                    code: result.error.code,
                });
            }
            return { projectId: result.data.id };
        },
        async importSourceProject({ ownerId, zipBuffer }) {
            if (!projectsContainer.importProjectUseCase) {
                throw new Error("IMPORT_NOT_WIRED");
            }
            const result = await projectsContainer.importProjectUseCase.execute({
                userId: ownerId,
                zipBuffer,
            });
            if (!result.success) {
                throw Object.assign(new Error(result.error.message), {
                    code: result.error.code,
                });
            }
            return { projectId: result.data.project.id };
        },
        async readSourceProjectFiles(projectId) {
            const [allFiles, settings] = await Promise.all([
                projectFilesContainer.getFileRepo().listByProjectId(projectId),
                projectsContainer.getSettingsRepo().findOrCreate(projectId),
            ]);
            // Text-only: inline files carry `textContent`; binary files (stored in
            // blob storage) have null content and are skipped (matches the
            // text-only template materialization contract).
            const files = allFiles
                .filter((f) => f.textContent !== null)
                .map((f) => ({ path: f.path, content: f.textContent as string }));
            return { files, entryPath: settings.mainPath };
        },
    };
    templatesContainer.wireSourceProjectAuthoring(sourceProjectGateway);

    // Build bibliography container
    const bibliographyContainer = new BibliographyContainer(
        bibliographyService,
        projectAccessPolicy,
    );

    // Build Zotero container
    const secretCipher = new SecretCipher(app.config.auth.jwtSecret);
    const zoteroContainer = new ZoteroContainer(
        app.prisma,
        secretCipher,
        bibliographyService,
        projectAccessPolicy,
        app.config.bibliography.zoteroApiBase,
    );

    // Build OpenAlex container
    const openalexContainer = new OpenAlexContainer(
        app.prisma,
        bibliographyService,
        projectAccessPolicy,
        app.config.bibliography.openalexMailto,
    );

    // Build Capture container (web capture + cite). Writes to the user's Zotero
    // library through an adapter over the zotero module's SaveItemsToLibrary use
    // case, so the capture module never touches zotero infra directly.
    const zoteroLibraryWriter: LibraryWriterPort = {
        saveItems: (userId, items) =>
            zoteroContainer.saveItemsToLibrary.execute({ userId, items }),
    };
    // OpenAlex-backed fallback so DOI/arXiv capture works even without a
    // running translation-server (no Docker required for the common case).
    const captureIdentifierFallback = new OpenAlexIdentifierFallback(
        new OpenAlexApiClient({ mailto: app.config.bibliography.openalexMailto }),
    );
    const captureContainer = new CaptureContainer(
        bibliographyService,
        projectAccessPolicy,
        zoteroLibraryWriter,
        app.config.bibliography.translationServerUrl,
        captureIdentifierFallback,
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

    // Register admin project oversight routes (admin only)
    await app.register(async (instance) => {
        await adminProjectRoutes(instance, projectsContainer);
    }, { prefix: "/api/v1/admin" });
    await app.register(async (instance) => {
        await adminCompileRoutes(instance, compileContainer);
    }, { prefix: "/api/v1/admin" });

    // Register bibliography integration routes
    await app.register(async (instance) => {
        await bibliographyRoutes(instance, bibliographyContainer);
    }, { prefix: "/api/v1" });
    await app.register(async (instance) => {
        await zoteroRoutes(instance, zoteroContainer);
    }, { prefix: "/api/v1" });
    await app.register(async (instance) => {
        await openalexRoutes(instance, openalexContainer);
    }, { prefix: "/api/v1" });
    await app.register(async (instance) => {
        await captureRoutes(instance, captureContainer);
    }, { prefix: "/api/v1" });

    return app;
}
