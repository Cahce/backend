
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
  create(data: CreateCompileArtifactData): Promise<CompileArtifact>;

  findById(id: string): Promise<CompileArtifact | null>;

  findByJobId(jobId: string): Promise<CompileArtifact | null>;

  findLatestByProjectId(projectId: string): Promise<CompileArtifact | null>;
}
