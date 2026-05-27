/**
 * ProjectFileSnapshot port
 *
 * Read-only port for accessing project files during compilation.
 * This port allows the compile module to depend on project-files
 * without directly importing its infrastructure layer.
 *
 * BREAKING (B-8): `listFiles` now returns an `AsyncIterable<ProjectFileSnapshot>`
 * instead of `Promise<ProjectFileSnapshot[]>`. This lets the consumer
 * `for await` one file at a time and stream it to disk, instead of buffering
 * every project file (including all binary blobs) into RAM up front. Without
 * this, a 200-image / 1 GB project could OOM a 512 MB container before the
 * compile even started. See `SnapshotTooLargeError` for the hard upper bound.
 */

export interface ProjectFileSnapshot {
  path: string;
  /** UTF-8 text for typst/bib files; raw bytes for image/data files */
  content: string | Buffer;
}

/**
 * Thrown by snapshot adapters when the cumulative byte size of the snapshot
 * exceeds the configured `MAX_SNAPSHOT_BYTES`. Caller (compile job runner)
 * should map this to a job failure rather than letting the process crash.
 */
export class SnapshotTooLargeError extends Error {
  constructor(public readonly bytes: number, public readonly limit: number) {
    super(`Project snapshot exceeds ${limit} bytes (got ${bytes}+)`);
    this.name = 'SnapshotTooLargeError';
  }
}

export interface ProjectFileSnapshotPort {
  /**
   * Iterate all files in a project suitable for compilation.
   * Returns files with kind: typst, bib, image, or data, yielded one at a
   * time so the caller can stream them to disk without buffering the entire
   * snapshot in memory.
   *
   * Throws `SnapshotTooLargeError` if the cumulative byte size exceeds the
   * adapter's configured limit.
   */
  listFiles(projectId: string): AsyncIterable<ProjectFileSnapshot>;
}
