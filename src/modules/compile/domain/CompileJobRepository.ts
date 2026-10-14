
import type { CompileJob } from './CompileJob.js';

export interface CreateCompileJobData {
  actorId?: string;
  projectId: string;
  entryPath: string;
  format: 'pdf';
  engine: 'node';
}

export interface CompileJobRepository {
  create(data: CreateCompileJobData): Promise<CompileJob>;

  findById(id: string): Promise<CompileJob | null>;

  findActiveByEntry(projectId: string, entryPath: string): Promise<CompileJob | null>;

  listByProjectId(projectId: string): Promise<CompileJob[]>;

  /** All jobs still in 'queued' status (recovery scan after a restart). */
  findAllQueued(limit?: number, excludeIds?: string[]): Promise<CompileJob[]>;

  /** Jobs in 'running' status whose updatedAt is older than the given date (zombie detection). */
  findRunningOlderThan(olderThan: Date, limit?: number, excludeIds?: string[]): Promise<CompileJob[]>;

  save(job: CompileJob): Promise<void>;
}
