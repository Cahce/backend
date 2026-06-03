/**
 * CompileArtifact repository port
 */

export interface CompileArtifact {
  id: string;
  projectId: string;
  jobId: string;
  format: 'pdf';
  storageKey: string;
  sizeBytes: number;
  sha256: string;
  createdAt: Date;
}

export interface CreateCompileArtifactData {
  projectId: string;
  jobId: string;
  format: 'pdf';
  storageKey: string;
  sizeBytes: number;
  sha256: string;
}

export interface CompileArtifactRepository {
  /**
   * Create a new compile artifact
   */
  create(data: CreateCompileArtifactData): Promise<CompileArtifact>;

  /**
   * Find artifact by ID
   */
  findById(id: string): Promise<CompileArtifact | null>;

  /**
   * Find artifact by job ID
   */
  findByJobId(jobId: string): Promise<CompileArtifact | null>;

  /**
   * Find the most recent PDF artifact for a project (across all jobs).
   * Used by the admin oversight PDF download.
   */
  findLatestByProjectId(projectId: string): Promise<CompileArtifact | null>;
}
