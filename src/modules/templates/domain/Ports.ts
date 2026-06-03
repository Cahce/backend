/**
 * Template Repository and Storage Ports
 * 
 * Domain interfaces for Template data access and storage operations.
 * Infrastructure layer will provide the concrete implementations.
 * No framework dependencies.
 */

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

/**
 * Template repository interface
 * 
 * Defines data access operations for Template and TemplateVersion entities.
 * Infrastructure layer (TemplateRepoPrisma) will implement this interface.
 */
export interface TemplateRepo {
  /**
   * Create a new Template
   */
  create(data: CreateTemplateData): Promise<Template>;

  /**
   * Find Template by ID
   */
  findById(id: string): Promise<Template | null>;

  /**
   * List templates with filtering and pagination (admin)
   */
  list(filter: TemplateFilter): Promise<{ items: Template[]; total: number }>;

  /**
   * List public templates (active only) with latest version
   */
  listPublic(): Promise<TemplateWithLatestVersion[]>;

  /**
   * Update an existing Template
   */
  update(id: string, patch: UpdateTemplateData): Promise<Template>;

  /**
   * Delete a Template
   */
  delete(id: string): Promise<void>;

  /**
   * Link a template to its editable "source project" (admin authoring copy).
   * Pass-through update of `Template.sourceProjectId`.
   */
  setSourceProject(templateId: string, projectId: string): Promise<void>;

  /**
   * Count projects using this template or any of its versions
   */
  countProjectsUsing(id: string): Promise<number>;

  /**
   * Count projects using each of the given templates (batched).
   *
   * Returns a Map keyed by templateId. Templates with zero usage may be
   * omitted; callers should default to 0.
   *
   * Used by the admin list endpoint to populate `usageCount` without N+1
   * queries.
   */
  countUsageByTemplateIds(templateIds: string[]): Promise<Map<string, number>>;

  /**
   * Create a new TemplateVersion
   */
  createVersion(data: CreateVersionData): Promise<TemplateVersion>;

  /**
   * Find TemplateVersion by ID
   */
  findVersionById(versionId: string): Promise<TemplateVersion | null>;

  /**
   * List all versions of a template
   */
  listVersionsByTemplate(templateId: string): Promise<TemplateVersion[]>;

  /**
   * Set version active/inactive
   */
  setVersionActive(versionId: string, isActive: boolean): Promise<TemplateVersion>;

  /**
   * Update version metadata (changelog and/or isActive).
   *
   * Throws `Error('VERSION_NOT_FOUND')` if the version doesn't exist.
   * At least one field must be present in `patch`; the call site is
   * responsible for validating that — the repo applies whatever it receives.
   */
  updateVersion(
    versionId: string,
    patch: { changelog?: string | null; isActive?: boolean },
  ): Promise<TemplateVersion>;
}

/**
 * Template storage gateway interface
 * 
 * Abstracts file storage operations for template content.
 * Phase 1: filesystem implementation (TemplateStorageFs)
 * Future: could be S3/MinIO implementation
 */
export interface TemplateStorageGateway {
  /**
   * Write archive (single .typ or .zip) to storage
   *
   * @param input - Archive metadata and stream
   * @returns Storage key and file count
   */
  writeArchive(input: {
    templateId: string;
    versionId: string;
    archive: AsyncIterable<Buffer>;
    archiveType: 'typ' | 'zip';
  }): Promise<{ storageKey: string; fileCount: number; entryPath: string }>;

  /**
   * Write a set of already-materialized text files as a new version directory.
   *
   * Used when publishing a template version from an edited "source project":
   * the files are in-memory text (not an uploaded archive). Mirrors the
   * `writeArchive` storage layout (`{templateId}/{versionId}`).
   *
   * @throws Error('INVALID_ARCHIVE') if a path is unsafe (absolute / traversal)
   *   or `entryPath` is not present among `files`.
   */
  writeFiles(input: {
    templateId: string;
    versionId: string;
    files: { path: string; content: string }[];
    entryPath: string;
  }): Promise<{ storageKey: string; fileCount: number; entryPath: string }>;

  /**
   * Read all files from storage
   *
   * @param storageKey - Storage key (relative path)
   * @returns List of files with path and content
   */
  readFiles(storageKey: string): Promise<MaterializedFile[]>;

  /**
   * Bundle the entire stored version directory into a single .zip Buffer.
   *
   * Used by the admin download endpoint. Includes binary files (images, etc.)
   * — unlike `readFiles` which only returns text. If the directory contains
   * exactly one file (the original single-`.typ` upload case), the zip still
   * wraps it so the response shape is consistent for the client.
   *
   * Throws `Error('VERSION_NOT_FOUND')` if the directory doesn't exist.
   */
  readArchive(storageKey: string): Promise<Buffer>;

  /**
   * Remove files from storage
   *
   * @param storageKey - Storage key (relative path)
   */
  remove(storageKey: string): Promise<void>;
}

/**
 * MaterializeTemplate function type
 * 
 * Used by projects module to materialize template version files.
 * This is the cross-module interface.
 */
export type MaterializeTemplate = (versionId: string) => Promise<MaterializedFile[]>;

/**
 * Source-project gateway (cross-module).
 *
 * Lets the templates module author template content inside a real, admin-owned
 * "source project" (reusing the projects + project-files modules) without
 * importing their infra directly. Wired in `app.ts` from the projects and
 * project-files containers — mirroring how `MaterializeTemplate` is injected
 * the other direction.
 *
 * Implementations may throw an `Error` carrying a `code` property on failure
 * (e.g. `ZIP_MALFORMED`); the calling use case maps it to a template error.
 */
export interface SourceProjectGateway {
  /**
   * Create a source project owned by `ownerId`. When `templateVersionId` is
   * provided, the project is seeded from that version's files; otherwise a
   * blank Typst project is scaffolded.
   */
  createSourceProject(input: {
    title: string;
    category: string;
    ownerId: string;
    templateVersionId?: string | null;
  }): Promise<{ projectId: string }>;

  /**
   * Create a source project owned by `ownerId` seeded from an uploaded .zip.
   */
  importSourceProject(input: {
    ownerId: string;
    zipBuffer: Buffer;
  }): Promise<{ projectId: string }>;

  /**
   * Read a source project's current text files plus its entry path
   * (`ProjectSettings.mainPath`) so they can be published as a version.
   */
  readSourceProjectFiles(projectId: string): Promise<{
    files: { path: string; content: string }[];
    entryPath: string;
  }>;
}
