
import type { CompileJob } from '../domain/CompileJob.js';
import type { CompileJobRepository } from '../domain/CompileJobRepository.js';
import type { OfficialCompileAccessPolicy } from '../domain/Policies.js';
import type { CompileQueue } from '../domain/CompileQueue.js';
import { enqueueOrReuseCompileJob } from './EnqueueOrReuseCompileJob.js';

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
    private readonly timeoutMs: number,
  ) {}

  async execute(cmd: EnqueueCompileJobCommand): Promise<CompileJob> {
    await this.access.requireOfficialCompileAccess(cmd.projectId, cmd.userId, cmd.userRole);

    return enqueueOrReuseCompileJob(this.repo, this.queue, {
      actorId: cmd.userId,
      projectId: cmd.projectId,
      entryPath: cmd.entryPath,
      format: cmd.format,
      engine: cmd.engine,
    }, this.timeoutMs);
  }
}
