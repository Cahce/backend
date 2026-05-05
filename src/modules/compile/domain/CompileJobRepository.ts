/**
 * CompileJob repository port
 */

import type { CompileJob } from './CompileJob.js';

export interface CreateCompileJobData {
  projectId: string;
  entryPath: string;
  format: 'pdf';
  engine: 'node';
}

export interface CompileJobRepository {
  /**
   * Create a new compile job in queued status
   */
  create(data: CreateCompileJobData): Promise<CompileJob>;

  /**
   * Find a compile job by ID
   */
  findById(id: string): Promise<CompileJob | null>;

  /**
   * Find active (queued or running) job for a given project and entry path
   * Used for deduplication
   */
  findActiveByEntry(projectId: string, entryPath: string): Promise<CompileJob | null>;

  /**
   * List all compile jobs for a project, ordered by createdAt desc
   */
  listByProjectId(projectId: string): Promise<CompileJob[]>;

  /**
   * Save (update) an existing compile job
   */
  save(job: CompileJob): Promise<void>;
}
