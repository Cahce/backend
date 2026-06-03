/**
 * Prisma implementation of CompileArtifactRepository
 */

import type { PrismaClient } from '../../../generated/prisma/index.js';
import type {
  CompileArtifact,
  CompileArtifactRepository,
  CreateCompileArtifactData,
} from '../domain/CompileArtifactRepository.js';

export class PrismaCompileArtifactRepository implements CompileArtifactRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateCompileArtifactData): Promise<CompileArtifact> {
    const artifact = await this.prisma.compileArtifact.create({
      data: {
        projectId: data.projectId,
        jobId: data.jobId,
        format: data.format,
        storageKey: data.storageKey,
        sizeBytes: data.sizeBytes,
        sha256: data.sha256,
      },
    });

    return {
      id: artifact.id,
      projectId: artifact.projectId,
      jobId: artifact.jobId || '',
      format: artifact.format as 'pdf',
      storageKey: artifact.storageKey,
      sizeBytes: artifact.sizeBytes || 0,
      sha256: artifact.sha256 || '',
      createdAt: artifact.createdAt,
    };
  }

  async findById(id: string): Promise<CompileArtifact | null> {
    const artifact = await this.prisma.compileArtifact.findUnique({
      where: { id },
    });

    if (!artifact) {
      return null;
    }

    return {
      id: artifact.id,
      projectId: artifact.projectId,
      jobId: artifact.jobId || '',
      format: artifact.format as 'pdf',
      storageKey: artifact.storageKey,
      sizeBytes: artifact.sizeBytes || 0,
      sha256: artifact.sha256 || '',
      createdAt: artifact.createdAt,
    };
  }

  async findByJobId(jobId: string): Promise<CompileArtifact | null> {
    const artifact = await this.prisma.compileArtifact.findFirst({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    });

    if (!artifact) {
      return null;
    }

    return {
      id: artifact.id,
      projectId: artifact.projectId,
      jobId: artifact.jobId || '',
      format: artifact.format as 'pdf',
      storageKey: artifact.storageKey,
      sizeBytes: artifact.sizeBytes || 0,
      sha256: artifact.sha256 || '',
      createdAt: artifact.createdAt,
    };
  }

  async findLatestByProjectId(projectId: string): Promise<CompileArtifact | null> {
    const artifact = await this.prisma.compileArtifact.findFirst({
      where: { projectId, format: 'pdf' },
      orderBy: { createdAt: 'desc' },
    });

    if (!artifact) {
      return null;
    }

    return {
      id: artifact.id,
      projectId: artifact.projectId,
      jobId: artifact.jobId || '',
      format: artifact.format as 'pdf',
      storageKey: artifact.storageKey,
      sizeBytes: artifact.sizeBytes || 0,
      sha256: artifact.sha256 || '',
      createdAt: artifact.createdAt,
    };
  }
}
