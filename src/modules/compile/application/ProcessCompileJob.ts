/**
 * ProcessCompileJob use case
 * 
 * Worker handler that processes a compile job.
 */

import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { CompileJobRepository } from '../domain/CompileJobRepository.js';
import type { CompileArtifactRepository } from '../domain/CompileArtifactRepository.js';
import type { ProjectFileSnapshotPort } from '../domain/ProjectFileSnapshotPort.js';
import type { TypstCompileService } from '../domain/TypstCompileService.js';
import type { BlobStorage } from '../../../shared/storage/BlobStorage.js';

export interface CompileLogger {
  info(obj: Record<string, unknown>, msg?: string): void;
}

export class ProcessCompileJob {
  constructor(
    private readonly jobs: CompileJobRepository,
    private readonly artifacts: CompileArtifactRepository,
    private readonly snapshot: ProjectFileSnapshotPort,
    private readonly compiler: TypstCompileService,
    private readonly storage: BlobStorage,
    private readonly timeoutMs: number,
    private readonly log?: CompileLogger,
  ) {}

  async execute(jobId: string): Promise<void> {
    const job = await this.jobs.findById(jobId);
    if (!job) {
      return;
    }

    // Start job
    job.start();
    await this.jobs.save(job);

    const startMs = Date.now();
    const workDir = await mkdtemp(join(tmpdir(), 'typst-'));
    try {
      // Stream project files to temp directory one at a time. The snapshot
      // adapter yields each file and enforces a cumulative byte ceiling
      // (MAX_SNAPSHOT_BYTES) — throws SnapshotTooLargeError if a project
      // exceeds the limit, which propagates to the catch below and surfaces
      // as a failed job (instead of OOM'ing the worker).
      for await (const f of this.snapshot.listFiles(job.projectId)) {
        const dest = join(workDir, f.path);
        await mkdir(dirname(dest), { recursive: true });
        await writeFile(dest, f.content);
      }

      // Compile
      const outputPath = join(workDir, 'output.pdf');
      const result = await this.compiler.compile({
        workDir,
        entryPath: job.entryPath,
        outputPath,
        timeoutMs: this.timeoutMs,
      });

      if (!result.ok) {
        job.fail(result.diagnostics);
        await this.jobs.save(job);
        this.log?.info({ jobId, projectId: job.projectId, status: 'failed', durationMs: Date.now() - startMs });
        return;
      }

      // Read PDF
      const pdf = await readFile(outputPath);

      // Store artifact
      const storageKey = randomUUID();
      const meta = await this.storage.put(storageKey, pdf, 'application/pdf');

      // Create artifact record
      const artifact = await this.artifacts.create({
        projectId: job.projectId,
        jobId: job.id,
        format: 'pdf',
        storageKey: storageKey,
        sizeBytes: meta.sizeBytes,
        sha256: meta.sha256,
      });

      job.succeed(artifact.id);
      await this.jobs.save(job);
      this.log?.info({ jobId, projectId: job.projectId, status: 'success', durationMs: Date.now() - startMs });
    } catch (error) {
      job.fail([
        {
          severity: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      ]);
      await this.jobs.save(job);
      this.log?.info({ jobId, projectId: job.projectId, status: 'failed', durationMs: Date.now() - startMs });
    } finally {
      // Clean up temp directory
      await rm(workDir, { recursive: true, force: true });
    }
  }
}
