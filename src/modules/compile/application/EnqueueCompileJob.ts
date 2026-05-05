/**
 * EnqueueCompileJob use case
 * 
 * Enqueues a new compile job with deduplication logic.
 */

import type { CompileJob } from '../domain/CompileJob.js';
import type { CompileJobRepository } from '../domain/CompileJobRepository.js';
import type { ProjectAccessPolicy } from '../domain/Policies.js';
import type { CompileQueue } from '../domain/CompileQueue.js';

export interface EnqueueCompileJobCommand {
  projectId: string;
  userId: string;
  entryPath: string;
  format: 'pdf';
  engine: 'node';
}

export class EnqueueCompileJob {
  constructor(
    private readonly repo: CompileJobRepository,
    private readonly access: ProjectAccessPolicy,
    private readonly queue: CompileQueue,
  ) {}

  async execute(cmd: EnqueueCompileJobCommand): Promise<CompileJob> {
    // Check project access
    await this.access.requireProjectAccess(cmd.projectId, cmd.userId);

    // Check for existing active job (deduplication)
    const existing = await this.repo.findActiveByEntry(cmd.projectId, cmd.entryPath);
    if (existing) {
      return existing;
    }

    // Create new job
    const job = await this.repo.create({
      projectId: cmd.projectId,
      entryPath: cmd.entryPath,
      format: cmd.format,
      engine: cmd.engine,
    });

    // Enqueue for processing
    await this.queue.enqueue(job.id);

    return job;
  }
}
