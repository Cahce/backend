/**
 * GetCompileJob use case
 * 
 * Gets a specific compile job by ID.
 */

import type { CompileJob } from '../domain/CompileJob.js';
import type { CompileJobRepository } from '../domain/CompileJobRepository.js';
import type { ProjectAccessPolicy } from '../../projects/domain/access/ProjectAccessPolicies.js';
import { CompileJobError, CompileErrors } from '../domain/Errors.js';

export interface GetCompileJobCommand {
  projectId: string;
  jobId: string;
  userId: string;
}

export class GetCompileJob {
  constructor(
    private readonly repo: CompileJobRepository,
    private readonly access: ProjectAccessPolicy,
  ) {}

  async execute(cmd: GetCompileJobCommand): Promise<CompileJob> {
    // Check project access
    await this.access.requireProjectAccess(cmd.projectId, cmd.userId);

    // Find job
    const job = await this.repo.findById(cmd.jobId);
    if (!job) {
      throw new CompileJobError(
        CompileErrors.COMPILE_JOB_NOT_FOUND,
        `Compile job ${cmd.jobId} not found`,
      );
    }

    // Verify job belongs to project
    if (job.projectId !== cmd.projectId) {
      throw new CompileJobError(
        CompileErrors.COMPILE_JOB_NOT_FOUND,
        `Compile job ${cmd.jobId} does not belong to project ${cmd.projectId}`,
      );
    }

    return job;
  }
}
