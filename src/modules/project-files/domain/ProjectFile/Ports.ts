
import type { File, FileMetadata, CreateFileData, UpdateFileData, RenameFileData } from './Types.js';
import type { FileKind } from './Types.js';

export interface FileRepo {
  create(data: CreateFileData & { storageMode: string; sizeBytes: number; sha256: string }): Promise<File>;

  createBinary(data: {
    projectId: string;
    path: string;
    kind: FileKind;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
  }): Promise<File>;

  findById(id: string): Promise<File | null>;

  findByProjectIdAndPath(projectId: string, path: string): Promise<File | null>;

  listByProjectId(projectId: string): Promise<File[]>;

  listMetadataByProjectId(projectId: string): Promise<FileMetadata[]>;

  update(data: UpdateFileData & { sizeBytes: number; sha256: string }): Promise<File>;

  rename(data: RenameFileData): Promise<File>;

  delete(projectId: string, path: string): Promise<void>;

  findForCompilation(projectId: string): Promise<File[]>;

  exists(projectId: string, path: string): Promise<boolean>;
}
