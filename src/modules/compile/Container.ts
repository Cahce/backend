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
import { PrismaCompileAccessRepository } from './infra/PrismaCompileAccessRepository.js';

// Import project settings repository
import { PrismaProjectSettingsRepository } from '../projects/infra/PrismaProjectSettingsRepository.js';

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
  const snapshot = new PrismaProjectFileSnapshotAdapter(app.prisma, app.storage, {
    maxBytes: app.config.compile.maxSnapshotBytes,
  });
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
    app.config.compile.timeoutMs,
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

  // Access policy: read (compile job/artifact views) + official compile gate
  // (enqueue/export). Implemented in compile/infra so wiring stays query-free.
  const accessPolicy = new PrismaCompileAccessRepository(app.prisma);

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
    app.config.compile.timeoutMs + 15000,
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
