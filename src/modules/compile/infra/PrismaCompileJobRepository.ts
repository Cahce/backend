/**
 * Prisma implementation of CompileJobRepository
 */

import type { Prisma, PrismaClient } from '../../../generated/prisma/index.js';
import { z } from 'zod';
import type { CompileJobRepository, CreateCompileJobData } from '../domain/CompileJobRepository.js';
import { CompileJob, type CompileStatus } from '../domain/CompileJob.js';
import type { CompileDiagnostic } from '../domain/CompileDiagnostic.js';

// Zod schema for validating diagnostics JSON
const DiagnosticPositionSchema = z.object({
  line: z.number(),
  column: z.number(),
});

const DiagnosticRangeSchema = z.object({
  start: DiagnosticPositionSchema,
  end: DiagnosticPositionSchema,
});

const CompileDiagnosticSchema = z.object({
  severity: z.enum(['error', 'warning', 'hint', 'info']),
  message: z.string(),
  file: z.string().optional(),
  range: DiagnosticRangeSchema.optional(),
  hints: z.array(z.string()).optional(),
});

const DiagnosticsArraySchema = z.array(CompileDiagnosticSchema);

export class PrismaCompileJobRepository implements CompileJobRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateCompileJobData): Promise<CompileJob> {
    const now = new Date();
    const job = await this.prisma.compileJob.create({
      data: {
        projectId: data.projectId,
        entryPath: data.entryPath,
        engine: data.engine,
        status: 'queued',
        diagnostics: [],
        createdAt: now,
        updatedAt: now,
      },
    });

    return this.toDomain(job);
  }

  async findById(id: string): Promise<CompileJob | null> {
    const job = await this.prisma.compileJob.findUnique({
      where: { id },
    });

    if (!job) {
      return null;
    }

    return this.toDomain(job);
  }

  async findActiveByEntry(projectId: string, entryPath: string): Promise<CompileJob | null> {
    const job = await this.prisma.compileJob.findFirst({
      where: {
        projectId,
        entryPath,
        status: {
          in: ['queued', 'running'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!job) {
      return null;
    }

    return this.toDomain(job);
  }

  async listByProjectId(projectId: string): Promise<CompileJob[]> {
    const jobs = await this.prisma.compileJob.findMany({
      where: { projectId },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return jobs.map((job) => this.toDomain(job));
  }

  async save(job: CompileJob): Promise<void> {
    await this.prisma.compileJob.update({
      where: { id: job.id },
      data: {
        status: job.status,
        // CompileDiagnostic[] is JSON-serializable; cast to Prisma's JSON
        // input type after asserting unknown to satisfy structural checks.
        diagnostics: job.diagnostics as unknown as Prisma.InputJsonValue,
        latestArtifactId: job.latestArtifactId,
        updatedAt: job.updatedAt,
      },
    });
  }

  private toDomain(prismaJob: {
    id: string;
    projectId: string;
    entryPath: string;
    status: string;
    diagnostics: any;
    latestArtifactId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): CompileJob {
    // Validate and parse diagnostics JSON
    let diagnostics: CompileDiagnostic[] = [];
    try {
      const parsed = DiagnosticsArraySchema.parse(prismaJob.diagnostics);
      diagnostics = parsed;
    } catch (error) {
      console.error(`Failed to parse diagnostics for job ${prismaJob.id}:`, error);
      diagnostics = [];
    }

    return new CompileJob(
      prismaJob.id,
      prismaJob.projectId,
      prismaJob.entryPath,
      prismaJob.status as CompileStatus,
      diagnostics,
      prismaJob.latestArtifactId,
      prismaJob.createdAt,
      prismaJob.updatedAt,
    );
  }
}
