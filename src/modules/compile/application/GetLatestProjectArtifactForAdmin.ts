/**
 * GetLatestProjectArtifactForAdmin use case
 *
 * Returns the latest compiled PDF of a project for an admin. Follows
 * Overleaf's model: if a cached artifact already exists it is streamed
 * immediately; otherwise the project is compiled **on demand** server-side
 * (bundled Typst engine), the artifact is persisted (long-term cache), and
 * then streamed. Subsequent downloads reuse the cached artifact.
 *
 * Admin access is enforced at the route (`requireAdmin`); no owner/member
 * check here.
 */

import type { Readable } from 'node:stream';
import type { CompileJobRepository } from '../domain/CompileJobRepository.js';
import type { CompileArtifactRepository } from '../domain/CompileArtifactRepository.js';
import type { CompileQueue } from '../domain/CompileQueue.js';
import type { BlobStorage, BlobMetadata } from '../../../shared/storage/BlobStorage.js';
import { CompileJobError, CompileErrors } from '../domain/Errors.js';

export interface GetLatestProjectArtifactForAdminCommand {
  projectId: string;
}

export interface GetLatestProjectArtifactForAdminResult {
  stream: Readable;
  metadata: BlobMetadata;
}

/** Extra error code beyond the shared CompileErrors set. */
const COMPILE_FAILED = 'COMPILE_FAILED';

/**
 * Periodic DB re-check interval while awaiting a compile job. The queue's
 * settle signal normally wakes us sooner; this is the backstop (was a fixed
 * 400ms poll, which issued ~185 queries over a 75s budget).
 */
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
    // 1. Cached artifact? Stream it (instant path).
    let artifact = await this.artifacts.findLatestByProjectId(cmd.projectId);

    // 2. None yet → compile on demand and persist.
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

    // Reuse an in-flight job for the same entry (dedupe), else enqueue one.
    let job = await this.jobs.findActiveByEntry(projectId, entryPath);
    if (!job) {
      job = await this.jobs.create({ projectId, entryPath, format: 'pdf', engine: 'node' });
      await this.queue.enqueue(job.id);
    }

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

  /**
   * Wait for the job to reach success/failed, or the budget to elapse.
   *
   * Event-assisted: arms the queue's `waitForSettle` signal ONCE up front so we
   * wake the instant the worker finishes the job, instead of hammering the DB
   * every 400ms. A periodic re-check (every {@link SETTLE_FALLBACK_MS}) is the
   * correctness backstop for the race where the job settled before we armed, or
   * a queue without `waitForSettle` support.
   */
  private async pollUntilSettled(jobId: string) {
    const deadline = Date.now() + this.timeoutMs;
    const settled = this.queue.waitForSettle?.(jobId);

    let job = await this.jobs.findById(jobId);
    while (Date.now() < deadline) {
      if (job && (job.status === 'success' || job.status === 'failed')) {
        return job;
      }
      const waitMs = Math.min(SETTLE_FALLBACK_MS, Math.max(0, deadline - Date.now()));
      await Promise.race([
        // Resolves once, when the worker finishes the job (fast path).
        settled ?? new Promise<void>(() => {}),
        // Periodic re-check backstop (also the only signal if waitForSettle is
        // unsupported or the settle was missed).
        new Promise((resolve) => setTimeout(resolve, waitMs)),
      ]);
      job = await this.jobs.findById(jobId);
    }
    return job;
  }
}
