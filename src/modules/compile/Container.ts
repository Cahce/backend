/**
 * Compile module container
 * 
 * Dependency injection wiring for the compile module.
 */

import type { FastifyInstance } from 'fastify';
import type { CompileJob } from './domain/CompileJob.js';
import type { CompileJobResponse } from './delivery/http/Dto.js';
import { EnqueueCompileJob } from './application/EnqueueCompileJob.js';
import { ListCompileJobs } from './application/ListCompileJobs.js';
import { GetCompileJob } from './application/GetCompileJob.js';
import { GetLatestArtifact } from './application/GetLatestArtifact.js';
import { GetLatestProjectArtifactForAdmin } from './application/GetLatestProjectArtifactForAdmin.js';
import { ProcessCompileJob } from './application/ProcessCompileJob.js';
import { PrismaCompileJobRepository } from './infra/PrismaCompileJobRepository.js';
import { PrismaCompileArtifactRepository } from './infra/PrismaCompileArtifactRepository.js';
import { PrismaProjectFileSnapshotAdapter } from './infra/PrismaProjectFileSnapshotAdapter.js';
import { NodeTypstCompileService } from './infra/NodeTypstCompileService.js';
import { InProcessCompileQueue } from './infra/InProcessCompileQueue.js';
import type { ProjectAccessPolicy, OfficialCompileAccessPolicy } from './domain/Policies.js';
import { CompileJobError } from './domain/Errors.js';

// Import project settings repository
import { PrismaProjectSettingsRepository } from '../projects/infra/PrismaProjectSettingsRepository.js';
// Reuse the single authorization source of truth from the projects domain.
import {
  resolveProjectAccess,
  capabilitiesFor,
} from '../projects/domain/Project/Policies.js';

export interface CompileContainer {
  enqueueCompileJob: EnqueueCompileJob;
  listCompileJobs: ListCompileJobs;
  getCompileJob: GetCompileJob;
  getLatestArtifact: GetLatestArtifact;
  getLatestProjectArtifactForAdmin: GetLatestProjectArtifactForAdmin;
  getMainPath(projectId: string): Promise<string>;
  toResponse(job: CompileJob): CompileJobResponse;
}

export function buildCompileContainer(app: FastifyInstance): CompileContainer {
  // Repositories
  const jobs = new PrismaCompileJobRepository(app.prisma);
  const artifacts = new PrismaCompileArtifactRepository(app.prisma);
  const snapshot = new PrismaProjectFileSnapshotAdapter(app.prisma, app.storage);
  const settingsRepo = new PrismaProjectSettingsRepository(app.prisma);

  // Services
  const compiler = new NodeTypstCompileService();

  // Worker
  const processJob = new ProcessCompileJob(
    jobs,
    artifacts,
    snapshot,
    compiler,
    app.storage,
    Number(process.env.COMPILE_TIMEOUT_MS ?? 60000),
    app.log,
  );

  // Queue. Respect the validated config (defaults to true) rather than reading
  // the raw env var — otherwise an unset COMPILE_WORKER_ENABLED leaves the
  // worker off even though config.compile.workerEnabled defaults to true,
  // which would make admin compile-on-demand silently time out.
  const queue = new InProcessCompileQueue(processJob, {
    enabled: app.config.compile.workerEnabled,
    log: app.log,
  });

  // Start queue
  queue.start();

  // Access policy (reuse the projects-domain resolver as the single source of truth).
  // Implements both the read policy (compile job/artifact views) and the official
  // compile gate (enqueue).
  const accessPolicy: ProjectAccessPolicy & OfficialCompileAccessPolicy = {
    // READ access (view compile jobs/artifacts): owner or any member.
    async requireProjectAccess(projectId: string, userId: string): Promise<void> {
      const project = await app.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          members: {
            where: { userId },
          },
        },
      });

      if (!project) {
        throw new Error('PROJECT_NOT_FOUND');
      }

      if (project.ownerId !== userId && project.members.length === 0) {
        throw new Error('PROJECT_ACCESS_DENIED');
      }
    },

    // OFFICIAL compile/export: requires write-level access (owner or editor
    // member). Admin oversight (non-owner) and viewers are denied. Throws a
    // CompileJobError so the route maps it to a clean 403/404.
    async requireOfficialCompileAccess(
      projectId: string,
      userId: string,
      userRole: 'admin' | 'teacher' | 'student',
    ): Promise<void> {
      const project = await app.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          members: {
            where: { userId },
            select: { role: true },
          },
        },
      });

      if (!project) {
        throw new CompileJobError('PROJECT_NOT_FOUND', 'Không tìm thấy dự án');
      }

      const membershipRole = project.members[0]?.role ?? null;
      const level = resolveProjectAccess({
        ownerId: project.ownerId,
        userId,
        role: userRole,
        membershipRole,
      });

      if (!capabilitiesFor(level).canCompileOfficial) {
        throw new CompileJobError(
          'PROJECT_ACCESS_DENIED',
          'Bạn không có quyền biên dịch/xuất bản dự án này',
        );
      }
    },
  };

  // Use cases
  const enqueueCompileJob = new EnqueueCompileJob(jobs, accessPolicy, queue);
  const listCompileJobs = new ListCompileJobs(jobs, accessPolicy);
  const getCompileJob = new GetCompileJob(jobs, accessPolicy);
  const getLatestArtifact = new GetLatestArtifact(jobs, artifacts, accessPolicy, app.storage);
  const getLatestProjectArtifactForAdmin = new GetLatestProjectArtifactForAdmin(
    jobs,
    artifacts,
    queue,
    app.storage,
    getMainPath,
    Number(process.env.COMPILE_TIMEOUT_MS ?? 60000) + 15000,
  );

  // Helper to get main path from settings
  async function getMainPath(projectId: string): Promise<string> {
    const settings = await settingsRepo.findOrCreate(projectId);
    return settings.mainPath;
  }

  // Response mapper. CompileDiagnostic and CompileDiagnosticDto are
  // structurally identical; spread to convert ReadonlyArray to a mutable
  // array that fits the DTO's Array type.
  function toResponse(job: CompileJob): CompileJobResponse {
    return {
      id: job.id,
      projectId: job.projectId,
      entryPath: job.entryPath,
      status: job.status,
      diagnostics: [...job.diagnostics],
      latestArtifactId: job.latestArtifactId,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }

  return {
    enqueueCompileJob,
    listCompileJobs,
    getCompileJob,
    getLatestArtifact,
    getLatestProjectArtifactForAdmin,
    getMainPath,
    toResponse,
  };
}
