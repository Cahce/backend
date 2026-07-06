
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
  const jobs = new PrismaCompileJobRepository(app.prisma);
  const artifacts = new PrismaCompileArtifactRepository(app.prisma);
  const snapshot = new PrismaProjectFileSnapshotAdapter(app.prisma, app.storage, {
    maxBytes: app.config.compile.maxSnapshotBytes,
  });
  const settingsRepo = new PrismaProjectSettingsRepository(app.prisma);

  const compiler = new NodeTypstCompileService();

  const processJob = new ProcessCompileJob(
    jobs,
    artifacts,
    snapshot,
    compiler,
    app.storage,
    app.config.compile.timeoutMs,
    app.log,
  );

  const queue = new InProcessCompileQueue(processJob, {
    enabled: app.config.compile.workerEnabled,
    log: app.log,
  });

  queue.start();

  const accessPolicy = new PrismaCompileAccessRepository(app.prisma);

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

  async function getMainPath(projectId: string): Promise<string> {
    const settings = await settingsRepo.findOrCreate(projectId);
    return settings.mainPath;
  }

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
