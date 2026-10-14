import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { configPlugin } from "./plugins/Config.js";
import { config } from './config/index.js';
import { prismaPlugin } from "./plugins/Prisma.js";
import { lifecyclePlugin } from './plugins/Lifecycle.js';
import { metricsPlugin } from './plugins/Metrics.js';
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
import type { Readable } from "node:stream";
import { ProjectSharingUseCases } from './modules/projects/application/sharing/ProjectSharingUseCases.js';
import { PrismaSharingRepository } from './modules/projects/infra/sharing/PrismaSharingRepository.js';
import { ShareTokenCrypto } from './modules/projects/infra/sharing/ShareTokenCrypto.js';
import { projectSharingRoutes } from './modules/projects/delivery/http/ProjectSharing/Routes.js';
import { ProjectDiscussionUseCases } from './modules/project-discussion/application/ProjectDiscussionUseCases.js';
import { PrismaDiscussionRepository } from './modules/project-discussion/infra/PrismaDiscussionRepository.js';
import { projectDiscussionRoutes } from './modules/project-discussion/delivery/http/Routes.js';
import { RealtimeTickets } from './modules/project-discussion/application/RealtimeTickets.js';
import { randomBytes } from 'node:crypto';
import { RealtimeSocketLeases } from './modules/project-discussion/application/RealtimeSocketLeases.js';
import { LocalRealtimeSocketLeaseStore } from './modules/project-discussion/infra/LocalRealtimeSocketLeaseStore.js';
import { RedisRealtimeSocketLeaseStore } from './modules/project-discussion/infra/RedisRealtimeSocketLeaseStore.js';
import { LocalRealtimeTicketStore } from './modules/project-discussion/infra/LocalRealtimeTicketStore.js';
import { RedisRealtimeTicketStore } from './modules/project-discussion/infra/RedisRealtimeTicketStore.js';
import { sharedStatePlugin } from './plugins/SharedState.js';
import { PrismaRealtimeSessionPolicy } from './modules/project-discussion/infra/PrismaRealtimeSessionPolicy.js';
import { PostgresProjectEventWakeSource } from './modules/project-discussion/infra/PostgresProjectEventWakeSource.js';
import { registerProjectRealtime } from './modules/project-discussion/delivery/ws/ProjectRealtime.js';
import { discussionDocumentation } from './modules/project-discussion/delivery/http/OpenApi.js';

async function streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

export async function buildApp(): Promise<FastifyInstance> {
    const app = Fastify({
        trustProxy: config.server.trustProxy,
        logger: {
            level: process.env.LOG_LEVEL || "info",
        },
        ajv: {
            customOptions: {
                strict: false,
            },
        },
        keepAliveTimeout: 72_000,
        bodyLimit: 1_048_576,
    });

    // Global error handler — guarantees every uncaught error returns the
    const MESSAGE_BY_STATUS: Record<number, string> = {
        400: "Dữ liệu không hợp lệ",
        404: "Không tìm thấy tài nguyên",
        413: "Tệp tải lên vượt quá giới hạn cho phép",
        415: "Định dạng tệp không được hỗ trợ",
    };
    app.setErrorHandler((err, req, reply) => {
        const fastifyErr = err as { statusCode?: number; validation?: unknown };

        if (fastifyErr.validation != null) {
            return reply.code(400).send(errorEnvelope("VALIDATION_ERROR"));
        }

        const mapped = toErrorResponse(err);
        if (mapped.status !== 500) {
            if (mapped.retryAfterSeconds !== undefined) reply.header('Retry-After', String(mapped.retryAfterSeconds));
            if (mapped.body.error.code === 'REALTIME_UNAVAILABLE' || mapped.body.error.code === 'REALTIME_BUSY') reply.header('Retry-After', '1');
            return reply.code(mapped.status).send(mapped.body);
        }

        const sc = fastifyErr.statusCode;
        if (typeof sc === "number" && sc >= 400 && sc < 500) {
            return reply
                .code(sc)
                .send(errorEnvelope("HTTP_ERROR", MESSAGE_BY_STATUS[sc]));
        }

        req.log.error({ err }, "Unhandled error");
        return reply.code(500).send(errorEnvelope("INTERNAL_ERROR"));
    });

    await app.register(configPlugin);
    await app.register(metricsPlugin);

    await app.register(cors, {
        origin: process.env.CORS_ORIGIN || true,
        credentials: true,
        methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: [
            'X-File-Id',
            'X-File-Revision',
            'X-Last-Edited-At',
            'X-Created-At',
            'X-Updated-At',
            'X-Storage-Key',
            'ETag',
            'Retry-After',
        ],
        maxAge: 86400,
    });

    await app.register(prismaPlugin);
    await app.register(sharedStatePlugin);
    await app.register(lifecyclePlugin);

    await app.register(storagePlugin);

    await registerMultipart(app);

    await app.register(jwtPlugin);

    await app.register(tokenCleanupPlugin);

    if (process.env.ENABLE_SWAGGER !== "false") {
        await app.register(swaggerPlugin);
    }

    
    const templatesContainer = createTemplatesContainer({
        prisma: app.prisma,
        templateStorageDir: app.config.templateStorage.dir,
    });
    
    app.decorate("materializeTemplate", templatesContainer.getMaterializeFunction());
    
    const compileContainer = buildCompileContainer(app);

    const fileRepoForProjects = new FileRepoPrisma(app.prisma);
    const projectsContainer = new ProjectsContainer(
        app.prisma,
        fileRepoForProjects,
        app.materializeTemplate,
        app.storage,
    );
    const projectFilesContainer = new ProjectFilesContainer(
        app.prisma,
        projectsContainer.getProjectRepo(),
    );

    const bibliographyService = new BibliographyService(projectFilesContainer.getFileRepo());

    const projectAccessPolicy: ProjectAccessPolicy & ProjectWriteAccessPolicy & { requireExportAccess(projectId: string, userId: string): Promise<void> } =
        new PrismaProjectAccessRepository(app.prisma);

    projectFilesContainer.wireBinaryUpload(app.storage, projectAccessPolicy);

    projectsContainer.wireZipPortability(app.storage, { requireProjectAccess: (id, userId) => projectAccessPolicy.requireExportAccess(id, userId) });

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
                archiveBuffer: zipBuffer,
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
            const files: { path: string; content: string; data?: Buffer }[] = [];
            for (const f of allFiles) {
                if (f.textContent !== null) {
                    files.push({ path: f.path, content: f.textContent });
                } else if (f.storageKey) {
                    try {
                        const data = await streamToBuffer(await app.storage.get(f.storageKey));
                        files.push({ path: f.path, content: "", data });
                    } catch (err) {
                        app.log.warn(
                            { err, path: f.path },
                            "[readSourceProjectFiles] missing blob, skipping file",
                        );
                    }
                }
            }
            return { files, entryPath: settings.mainPath };
        },
    };
    templatesContainer.wireSourceProjectAuthoring(sourceProjectGateway);

    const bibliographyContainer = new BibliographyContainer(
        bibliographyService,
        projectAccessPolicy,
    );

    const secretCipher = new SecretCipher(app.config.auth.jwtSecret);
    const zoteroContainer = new ZoteroContainer(
        app.prisma,
        secretCipher,
        bibliographyService,
        projectAccessPolicy,
        app.config.bibliography.zoteroApiBase,
    );

    const openalexContainer = new OpenAlexContainer(
        app.prisma,
        bibliographyService,
        projectAccessPolicy,
        app.config.bibliography.openalexMailto,
    );

    const zoteroLibraryWriter: LibraryWriterPort = {
        saveItems: (userId, items) =>
            zoteroContainer.saveItemsToLibrary.execute({ userId, items }),
    };
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

    await app.register(healthRoutes);
    await app.register(authRoutes, { prefix: "/api/v1/auth" });
    await app.register(facultyRoutes, { prefix: "/api/v1/admin" });
    await app.register(departmentRoutes, { prefix: "/api/v1/admin" });
    await app.register(majorRoutes, { prefix: "/api/v1/admin" });
    await app.register(classRoutes, { prefix: "/api/v1/admin" });
    await app.register(teacherManagementRoutes, { prefix: "/api/v1/admin" });
    await app.register(studentManagementRoutes, { prefix: "/api/v1/admin" });
    await app.register(accountRoutes, { prefix: "/api/v1/admin" });
    
    await app.register(async (instance) => {
        await registerAdminTemplateRoutes(instance, templatesContainer);
    }, { prefix: "/api/v1/admin" });
    await app.register(async (instance) => {
        await registerPublicTemplateRoutes(instance, templatesContainer);
    }, { prefix: "/api/v1" });
    
    await app.register(async (instance) => {
        await projectRoutes(instance, projectsContainer);
    }, { prefix: "/api/v1" });
    if (app.config.collaboration.enabled) {
    const discussion = new ProjectDiscussionUseCases(new PrismaDiscussionRepository(app.prisma));
    const ticketStore = app.sharedRedis
        ? new RedisRealtimeTicketStore(app.sharedRedis, app.config.sharedState.namespace, app.config.sharedState.keySecret!)
        : new LocalRealtimeTicketStore();
    const tickets = new RealtimeTickets(new ShareTokenCrypto(), new PrismaRealtimeSessionPolicy(app.prisma), ticketStore);
    const eventWakeSource = new PostgresProjectEventWakeSource({ connectionString: app.config.db.directUrl }, message => app.log.warn(message));
    const leaseStore = app.sharedRedis
        ? new RedisRealtimeSocketLeaseStore(app.sharedRedis, app.config.sharedState.namespace, app.config.sharedState.keySecret!, app.config.collaboration.maxSocketsGlobal)
        : new LocalRealtimeSocketLeaseStore(app.config.collaboration.maxSocketsGlobal);
    const socketLeases = new RealtimeSocketLeases(leaseStore, () => randomBytes(16).toString('hex'));
    registerProjectRealtime(app, tickets, discussion, app.config.collaboration.origins, socketLeases, eventWakeSource, app.config.collaboration.maxSocketsPerInstance);
    await app.register(async instance => {
        await projectSharingRoutes(instance, new ProjectSharingUseCases(new PrismaSharingRepository(app.prisma), new ShareTokenCrypto()));
    }, { prefix: '/api/v1' });
    await app.register(async instance => {
        await projectDiscussionRoutes(instance, discussion);
        instance.post<{ Params: { projectId: string } }>('/projects/:projectId/realtime-ticket', { preHandler: instance.auth.verify, ...discussionDocumentation.ticket }, async req => {
            await app.requestRateLimit!.check(`realtime-ticket:${req.user.sub}`, 60);
            return tickets.create({ projectId: req.params.projectId, actor: { userId: req.user.sub, role: req.user.role },
                jti: req.user.jti, expiresAt: Number(req.user.exp) * 1000 });
        });
    }, { prefix: '/api/v1' });
    }
    await app.register(async (instance) => {
        await projectSettingsRoutes(instance, projectsContainer);
    }, { prefix: "/api/v1" });
    await app.register(async (instance) => {
        await projectFileRoutes(instance, projectFilesContainer);
    }, { prefix: "/api/v1" });
    await app.register(teacherProfileRoutes, { prefix: "/api/v1/teachers" });

    await app.register(async (instance) => {
        await compileRoutes(instance, compileContainer);
    }, { prefix: "/api/v1" });

    await app.register(async (instance) => {
        await adminProjectRoutes(instance, projectsContainer);
    }, { prefix: "/api/v1/admin" });
    await app.register(async (instance) => {
        await adminCompileRoutes(instance, compileContainer);
    }, { prefix: "/api/v1/admin" });

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
