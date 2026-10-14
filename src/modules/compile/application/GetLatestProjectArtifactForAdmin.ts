
import type { Readable } from 'node:stream';
import type { CompileJobRepository } from '../domain/CompileJobRepository.js';
import type { CompileArtifactRepository } from '../domain/CompileArtifactRepository.js';
import type { CompileQueue } from '../domain/CompileQueue.js';
import type { BlobStorage, BlobMetadata } from '../../../shared/storage/BlobStorage.js';
import { CompileJobError, CompileErrors } from '../domain/Errors.js';
import { enqueueOrReuseCompileJob } from './EnqueueOrReuseCompileJob.js';

export interface GetLatestProjectArtifactForAdminCommand {
  projectId: string;
}

export interface GetLatestProjectArtifactForAdminResult {
  stream: Readable;
  metadata: BlobMetadata;
}

const COMPILE_FAILED = 'COMPILE_FAILED';

const SETTLE_FALLBACK_MS = 2000;

export class GetLatestProjectArtifactForAdmin {
  constructor(
    private readonly jobs: CompileJobRepository,
    private readonly artifacts: CompileArtifactRepository,
    private readonly queue: CompileQueue,
    private readonly storage: BlobStorage,
    private readonly getMainPath: (projectId: string) => Promise<string>,
    private readonly timeoutMs: number,
  ) {}

  async execute(
    cmd: GetLatestProjectArtifactForAdminCommand,
  ): Promise<GetLatestProjectArtifactForAdminResult> {
    let artifact = await this.artifacts.findLatestByProjectId(cmd.projectId);

    if (!artifact) {
      artifact = await this.compileAndGetArtifact(cmd.projectId);
    }

    const metadata = await this.storage.head(artifact.storageKey);
    if (!metadata) {
      throw new CompileJobError(
        CompileErrors.STORAGE_NOT_FOUND,
        `Storage key ${artifact.storageKey} not found`,
      );
    }

    const stream = await this.storage.get(artifact.storageKey);
    return { stream, metadata };
  }

  private async compileAndGetArtifact(projectId: string) {
    const entryPath = await this.getMainPath(projectId);

    const job = await enqueueOrReuseCompileJob(this.jobs, this.queue,
      { projectId, entryPath, format: 'pdf', engine: 'node' }, this.timeoutMs);

    const finalJob = await this.pollUntilSettled(job.id);

    if (!finalJob || finalJob.status === 'queued' || finalJob.status === 'running') {
      throw new CompileJobError(
        CompileErrors.COMPILE_TIMEOUT,
        'Quá thời gian biên dịch PDF (kiểm tra COMPILE_WORKER_ENABLED).',
      );
    }
    if (finalJob.status === 'failed') {
      const first = finalJob.diagnostics[0]?.message;
      throw new CompileJobError(
        COMPILE_FAILED,
        first ? `Biên dịch PDF thất bại: ${first}` : 'Biên dịch PDF thất bại',
      );
    }
    if (!finalJob.latestArtifactId) {
      throw new CompileJobError(
        CompileErrors.COMPILE_ARTIFACT_NOT_READY,
        'Biên dịch xong nhưng không tạo được PDF',
      );
    }

    const artifact = await this.artifacts.findById(finalJob.latestArtifactId);
    if (!artifact) {
      throw new CompileJobError(
        CompileErrors.COMPILE_ARTIFACT_NOT_READY,
        'Không tìm thấy artifact sau biên dịch',
      );
    }
    return artifact;
  }

  private async pollUntilSettled(jobId: string) {
    const deadline = Date.now() + this.timeoutMs;
    const controller = new AbortController();
    let settled = this.queue.waitForSettle?.(jobId, controller.signal);
    try {
    let job = await this.jobs.findById(jobId);
    while (Date.now() < deadline) {
      if (job && (job.status === 'success' || job.status === 'failed')) {
        return job;
      }
      const waitMs = Math.min(SETTLE_FALLBACK_MS, Math.max(0, deadline - Date.now()));
      let timer: ReturnType<typeof setTimeout> | undefined;
      const reason = await Promise.race([
        settled?.then(() => 'settled') ?? new Promise<never>(() => {}),
        new Promise<string>(resolve => { timer = setTimeout(() => resolve('poll'), waitMs); }),
      ]);
      clearTimeout(timer);
      if (reason === 'settled') settled = undefined;
      job = await this.jobs.findById(jobId);
    }
    return job;
    } finally { controller.abort(); }
  }
}
