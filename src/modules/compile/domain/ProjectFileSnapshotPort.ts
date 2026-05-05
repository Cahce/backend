/**
 * ProjectFileSnapshot port
 * 
 * Read-only port for accessing project files during compilation.
 * This port allows the compile module to depend on project-files
 * without directly importing its infrastructure layer.
 */

export interface ProjectFileSnapshot {
  path: string;
  /** UTF-8 text for typst/bib files; raw bytes for image/data files */
  content: string | Buffer;
}

export interface ProjectFileSnapshotPort {
  /**
   * List all files in a project suitable for compilation
   * Returns files with kind: typst, bib, image, or data
   */
  listFiles(projectId: string): Promise<ProjectFileSnapshot[]>;
}
