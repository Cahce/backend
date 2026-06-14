/**
 * EnqueueCompileJob use case
 * 
 * Enqueues a new compile job with deduplication logic.
 */

import type { CompileJob } from '../domain/CompileJob.js';
import type { CompileJobRepository } from '../domain/CompileJobRepository.js';
import type { OfficialCompileAccessPolicy } from '../domain/Policies.js';
import type { CompileQueue } from '../domain/CompileQueue.js';

export interface EnqueueCompileJobCommand {
  projectId: string;
  userId: string;
  userRole: 'admin' | 'teacher' | 'student';
  entryPath: string;
  format: 'pdf';
  engine: 'node';
}

export class EnqueueCompileJob {
  constructor(
    private readonly repo: CompileJobRepository,
    private readonly access: OfficialCompileAccessPolicy,
    private readonly queue: CompileQueue,
  ) {}

  async execute(cmd: EnqueueCompileJobCommand): Promise<CompileJob> {
    // Official compile/export requires write-level access (owner or editor).
    // Admin oversight (non-owner) and viewers are denied.
    await this.access.requireOfficialCompileAccess(cmd.projectId, cmd.userId, cmd.userRole);

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
