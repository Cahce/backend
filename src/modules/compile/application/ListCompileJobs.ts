/**
 * ListCompileJobs use case
 * 
 * Lists all compile jobs for a project.
 */

import type { CompileJob } from '../domain/CompileJob.js';
import type { CompileJobRepository } from '../domain/CompileJobRepository.js';
import type { ProjectAccessPolicy } from '../../projects/domain/access/ProjectAccessPolicies.js';

export interface ListCompileJobsCommand {
  projectId: string;
  userId: string;
}

export class ListCompileJobs {
  constructor(
    private readonly repo: CompileJobRepository,
    private readonly access: ProjectAccessPolicy,
  ) {}

  async execute(cmd: ListCompileJobsCommand): Promise<CompileJob[]> {
    // Check project access
    await this.access.requireProjectAccess(cmd.projectId, cmd.userId);

    // List jobs
    return this.repo.listByProjectId(cmd.projectId);
  }
}
