/**
 * File Domain Types
 * 
 * Pure domain types for File entity - no framework dependencies.
 */

/**
 * File kind enumeration
 */
export enum FileKind {
  Typst = 'typst',
  Bib = 'bib',
  Image = 'image',
  Data = 'data',
  Other = 'other',
}

/**
 * Storage mode enumeration
 * Stage 1: Only 'inline' is used
 * Future: 'object_storage' will be supported
 */
export enum StorageMode {
  Inline = 'inline',
  ObjectStorage = 'object_storage',
}

/**
 * File entity representing a file within a project
 * 
 * Path uniqueness constraint: path must be unique within a projectId
 * (enforced by database unique constraint on [projectId, path])
 */
export type File = {
  id: string;
  projectId: string;
  path: string;
  kind: FileKind;
  storageMode: StorageMode;
  textContent: string | null;
  storageKey: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  lastEditedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * File metadata (excludes content fields)
 * Used for list operations
 */
export type FileMetadata = {
  id: string;
  projectId: string;
  path: string;
  kind: FileKind;
  mimeType: string | null;
  sizeBytes: number | null;
  lastEditedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Data required to create a new File
 */
export type CreateFileData = {
  projectId: string;
  path: string;
  kind: FileKind;
  content: string;
  mimeType?: string;
};

/**
 * Data required to update a File
 */
export type UpdateFileData = {
  projectId: string;
  path: string;
  content: string;
};

/**
 * Data required to rename a File
 */
export type RenameFileData = {
  projectId: string;
  oldPath: string;
  newPath: string;
};
