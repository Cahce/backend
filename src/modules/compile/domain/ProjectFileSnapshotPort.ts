
export interface ProjectFileSnapshot {
  path: string;
  content: string | Buffer;
}

export class SnapshotTooLargeError extends Error {
  constructor(public readonly bytes: number, public readonly limit: number) {
    super(`Project snapshot exceeds ${limit} bytes (got ${bytes}+)`);
    this.name = 'SnapshotTooLargeError';
  }
}

export interface ProjectFileSnapshotPort {
  listFiles(projectId: string): AsyncIterable<ProjectFileSnapshot>;
}
