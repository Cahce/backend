
import type {
  Template,
  TemplateVersion,
  TemplateWithLatestVersion,
  CreateTemplateData,
  UpdateTemplateData,
  TemplateFilter,
  CreateVersionData,
  MaterializedFile,
} from './Types.js';

export interface TemplateRepo {
  create(data: CreateTemplateData): Promise<Template>;

  findById(id: string): Promise<Template | null>;

  list(filter: TemplateFilter): Promise<{ items: Template[]; total: number }>;

  listPublic(): Promise<TemplateWithLatestVersion[]>;

  update(id: string, patch: UpdateTemplateData): Promise<Template>;

  delete(id: string): Promise<void>;

  setSourceProject(templateId: string, projectId: string): Promise<void>;

  countProjectsUsing(id: string): Promise<number>;

  countUsageByTemplateIds(templateIds: string[]): Promise<Map<string, number>>;

  createVersion(data: CreateVersionData): Promise<TemplateVersion>;

  findVersionById(versionId: string): Promise<TemplateVersion | null>;

  listVersionsByTemplate(templateId: string): Promise<TemplateVersion[]>;

  setVersionActive(versionId: string, isActive: boolean): Promise<TemplateVersion>;

  updateVersion(
    versionId: string,
    patch: { changelog?: string | null; isActive?: boolean },
  ): Promise<TemplateVersion>;
}

export interface TemplateStorageGateway {
  writeArchive(input: {
    templateId: string;
    versionId: string;
    archive: AsyncIterable<Buffer>;
    archiveType: 'typ' | 'zip';
  }): Promise<{ storageKey: string; fileCount: number; entryPath: string }>;

  writeFiles(input: {
    templateId: string;
    versionId: string;
    files: { path: string; content: string; data?: Buffer }[];
    entryPath: string;
  }): Promise<{ storageKey: string; fileCount: number; entryPath: string }>;

  readFiles(storageKey: string): Promise<MaterializedFile[]>;

  readArchive(storageKey: string): Promise<Buffer>;

  remove(storageKey: string): Promise<void>;
}

export type MaterializeTemplate = (versionId: string) => Promise<MaterializedFile[]>;

export interface SourceProjectGateway {
  createSourceProject(input: {
    title: string;
    category: string;
    ownerId: string;
    templateVersionId?: string | null;
  }): Promise<{ projectId: string }>;

  importSourceProject(input: {
    ownerId: string;
    zipBuffer: Buffer;
  }): Promise<{ projectId: string }>;

  readSourceProjectFiles(projectId: string): Promise<{
    files: { path: string; content: string; data?: Buffer }[];
    entryPath: string;
  }>;
}
