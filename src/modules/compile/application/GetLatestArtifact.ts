/**
 * GetLatestArtifact use case
 * 
 * Gets the latest artifact for a compile job and streams it.
 */

import type { Readable } from 'node:stream';
import type { CompileJobRepository } from '../domain/CompileJobRepository.js';
import type { CompileArtifactRepository } from '../domain/CompileArtifactRepository.js';
import type { ProjectAccessPolicy } from '../../projects/domain/access/ProjectAccessPolicies.js';
import type { BlobStorage, BlobMetadata } from '../../../shared/storage/BlobStorage.js';
import { CompileJobError, CompileErrors } from '../domain/Errors.js';

export interface GetLatestArtifactCommand {
  projectId: string;
  jobId: string;
  userId: string;
}

export interface GetLatestArtifactResult {
  stream: Readable;
  metadata: BlobMetadata;
}

export class GetLatestArtifact {
  constructor(
    private readonly jobs: CompileJobRepository,
    private readonly artifacts: CompileArtifactRepository,
    private readonly access: ProjectAccessPolicy,
    private readonly storage: BlobStorage,
  ) {}

  async execute(cmd: GetLatestArtifactCommand): Promise<GetLatestArtifactResult> {
    // Check project access
    await this.access.requireProjectAccess(cmd.projectId, cmd.userId);

    // Find job
    const job = await this.jobs.findById(cmd.jobId);
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

    // Check if artifact is ready
    if (!job.latestArtifactId) {
      throw new CompileJobError(
        CompileErrors.COMPILE_ARTIFACT_NOT_READY,
        `Compile job ${cmd.jobId} has no artifact yet`,
      );
    }

    // Find artifact
    const artifact = await this.artifacts.findById(job.latestArtifactId);
    if (!artifact) {
      throw new CompileJobError(
        CompileErrors.COMPILE_ARTIFACT_NOT_READY,
        `Artifact ${job.latestArtifactId} not found`,
      );
    }

    // Get metadata
    const metadata = await this.storage.head(artifact.storageKey);
    if (!metadata) {
      throw new CompileJobError(
        CompileErrors.STORAGE_NOT_FOUND,
        `Storage key ${artifact.storageKey} not found`,
      );
    }

    // Stream artifact
    const stream = await this.storage.get(artifact.storageKey);

    return {
      stream,
      metadata,
    };
  }
}
