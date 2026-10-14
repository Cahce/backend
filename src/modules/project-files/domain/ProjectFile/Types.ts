
export enum FileKind {
  Typst = 'typst',
  Bib = 'bib',
  Image = 'image',
  Vector = 'vector',
  Font = 'font',
  Markdown = 'markdown',
  Config = 'config',
  Data = 'data',
  Text = 'text',
  Pdf = 'pdf',
  Other = 'other',
}

export enum StorageMode {
  Inline = 'inline',
  ObjectStorage = 'object_storage',
}

export type File = {
  revision?: number;
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

export type FileMetadata = {
  revision?: number;
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

export type CreateFileData = {
  actorId?: string;
  projectId: string;
  path: string;
  kind: FileKind;
  content: string;
  mimeType?: string;
};

export type UpdateFileData = {
  actorId?: string;
  fileId?: string;
  baseRevision?: number;
  projectId: string;
  path: string;
  content: string;
};

export type RenameFileData = {
  actorId?: string;
  fileId?: string;
  baseRevision?: number;
  projectId: string;
  oldPath: string;
  newPath: string;
};
