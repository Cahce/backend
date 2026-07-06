
import type { CompileJob } from './CompileJob.js';

export interface CreateCompileJobData {
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

  save(job: CompileJob): Promise<void>;
}
