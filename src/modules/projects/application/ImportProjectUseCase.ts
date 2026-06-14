/**
 * Import Project Use Case
 *
 * Accepts an archive buffer (already loaded from multipart upload) — zip, 7z,
 * rar, tar, or tar.gz — validates its shape, creates a new project owned by
 * the caller, and persists every entry as either an inline text file or a
 * binary blob. Format detection + decompression are delegated to
 * {@link extractArchiveEntries} (`./extractArchive.ts`).
 *
 * Security & limits (enforced by the extractor, uniformly across formats):
 *   - Rejects path traversal (`..`, absolute paths).
 *   - Skips symlinks and directory entries.
 *   - Aborts with `ZIP_PAYLOAD_TOO_LARGE` if the **uncompressed** total exceeds
 *     `maxExpandedBytes` (default 200 MB) or any single entry exceeds
 *     `maxPerFileBytes` (default 20 MB). Defends against zip-bomb.
 *   - Rejects malformed archives (`ZIP_MALFORMED`) and unknown formats
 *     (`UNSUPPORTED_ARCHIVE`).
 *
 * Atomicity: project is created first, then files are appended. On per-file
 * failure mid-flight the project is left in a partial state (the caller may
 * delete it). A full transactional rollback would require lower-level
 * coordination across `projectRepo`, `fileRepo`, and `blobStorage` — out of
 * scope for the MVP; thesis-scale imports rarely fail mid-stream.
 */

import { createHash, randomUUID } from 'node:crypto';

import type { ProjectRepo } from '../domain/Project/Ports.js';
import { TemplateCategory, type Project } from '../domain/Project/Types.js';
import type { FileRepo } from '../../project-files/domain/ProjectFile/Ports.js';
import {
  detectKindFromPath,
  isBinaryKind,
} from '../../project-files/domain/FileKindPolicy.js';
import type { BlobStorage } from '../../../shared/storage/BlobStorage.js';
import { ProjectErrors } from '../domain/Project/Errors.js';
import { ProjectSettings } from '../domain/ProjectSettings.js';
import type { ProjectSettingsRepository } from '../domain/ProjectSettingsRepository.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';
import { detectMainPath, isTypstSource } from './detectMainPath.js';
import {
  extractArchiveEntries,
  ArchiveExtractionError,
  type PendingEntry,
} from './extractArchive.js';

const DEFAULT_MAX_EXPANDED = 200 * 1024 * 1024; // 200 MB
const DEFAULT_MAX_PER_FILE = 20 * 1024 * 1024; //  20 MB

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
};

export interface ImportProjectCommand {
  userId: string;
  /** Raw archive bytes (zip/7z/rar/tar/tar.gz); format detected from content. */
  zipBuffer: Buffer;
  /** Original upload filename — used only as an extension fallback for format
   *  detection when magic bytes are inconclusive. */
  filename?: string;
  /** Project category chosen by the user; defaults to `other` when omitted. */
  category?: TemplateCategory;
}

export interface ImportProjectResult {
  project: Project;
}

function decodeUtf8(data: Buffer): string | null {
  try {
    const text = data.toString('utf-8');
    return text.includes('\uFFFD') ? null : text;
  } catch {
    return null;
  }
}

function pickTitleFromToml(toml: string | null): string | null {
  if (!toml) return null;
  // Very small parse: look for a top-level `name = "..."` line.
  const match = toml.match(/^\s*name\s*=\s*"([^"\n]+)"/m);
  return match?.[1]?.trim() || null;
}

interface ArchiveRootNormalization {
  entries: PendingEntry[];
  strippedRoot: string | null;
}

function hasTypstProjectMarker(paths: string[]): boolean {
  const pathSet = new Set(paths);
  if (pathSet.has('project.toml')) return true;
  if (pathSet.has('typst.toml')) return true;
  if (pathSet.has('main.typ')) return true;

  // A single Typst file is a valid tiny project root, even without metadata.
  return paths.filter(isTypstSource).length === 1;
}

export function normalizeArchiveRoot(entries: PendingEntry[]): ArchiveRootNormalization {
  if (entries.length === 0) {
    return { entries, strippedRoot: null };
  }

  const segments = entries.map((entry) => entry.path.split('/'));
  if (!segments.every((parts) => parts.length > 1)) {
    return { entries, strippedRoot: null };
  }

  const roots = new Set(segments.map((parts) => parts[0]));
  if (roots.size !== 1) {
    return { entries, strippedRoot: null };
  }

  const [commonRoot] = Array.from(roots);
  const stripped = entries.map((entry) => ({
    ...entry,
    path: entry.path.slice(commonRoot.length + 1),
  }));

  if (
    stripped.some((entry) => !entry.path || entry.path === '.' || entry.path === '..') ||
    !hasTypstProjectMarker(stripped.map((entry) => entry.path))
  ) {
    return { entries, strippedRoot: null };
  }

  return { entries: stripped, strippedRoot: commonRoot };
}

function readToml(entries: PendingEntry[], name: string): string | null {
  const entry = entries.find(
    (item) => item.path === name || item.path.endsWith(`/${name}`),
  );
  return entry ? decodeUtf8(entry.data) : null;
}

export class ImportProjectUseCase {
  constructor(
    private readonly projectRepo: ProjectRepo,
    private readonly fileRepo: FileRepo,
    private readonly blobStorage: BlobStorage,
    private readonly settingsRepo?: ProjectSettingsRepository,
    private readonly maxExpandedBytes: number = DEFAULT_MAX_EXPANDED,
    private readonly maxPerFileBytes: number = DEFAULT_MAX_PER_FILE,
  ) {}

  async execute(
    command: ImportProjectCommand,
  ): Promise<Result<ImportProjectResult>> {
    // --- Extract + validate archive (zip/7z/rar/tar/tar.gz) ------------------
    let pending: PendingEntry[];
    try {
      pending = extractArchiveEntries(
        command.zipBuffer,
        command.filename,
        this.maxPerFileBytes,
        this.maxExpandedBytes,
      );
    } catch (err) {
      if (err instanceof ArchiveExtractionError) {
        return failure(err.code, err.message);
      }
      return failure(
        ProjectErrors.ZIP_MALFORMED.code,
        ProjectErrors.ZIP_MALFORMED.message,
      );
    }

    const normalisedArchive = normalizeArchiveRoot(pending);
    pending = normalisedArchive.entries;

    const projectToml = readToml(pending, 'project.toml');
    const typstToml = readToml(pending, 'typst.toml');
    const mainPath = detectMainPath(
      pending.map((entry) => ({
        path: entry.path,
        content: isTypstSource(entry.path) ? decodeUtf8(entry.data) : null,
      })),
      { typstToml, projectToml },
    );

    // --- Create project ------------------------------------------------------
    const title =
      pickTitleFromToml(projectToml) ??
      `Imported ${new Date().toISOString().slice(0, 10)}`;

    let project: Project;
    try {
      project = await this.projectRepo.create({
        title,
        category: command.category ?? TemplateCategory.Other,
        ownerId: command.userId,
        templateId: null,
        templateVersionId: null,
      });
    } catch (err) {
      console.error('[ImportProject] failed to create project:', err);
      return failure('INTERNAL_ERROR', 'Không thể tạo dự án mới');
    }

    // --- Persist files -------------------------------------------------------
    try {
      for (const { path: filePath, data } of pending) {
        const kind = detectKindFromPath(filePath);
        if (isBinaryKind(kind)) {
          const ext = filePath.toLowerCase().split('.').pop() ?? '';
          const mimeType = MIME_BY_EXT[ext] ?? 'application/octet-stream';
          const storageKey = `projects/${project.id}/${randomUUID()}-${filePath
            .split('/')
            .pop()}`;
          const meta = await this.blobStorage.put(storageKey, data, mimeType);
          await this.fileRepo.createBinary({
            projectId: project.id,
            path: filePath,
            kind,
            storageKey,
            mimeType: meta.contentType,
            sizeBytes: meta.sizeBytes,
            sha256: meta.sha256,
          });
        } else {
          // Treat as UTF-8 text. If decoding fails, fall back to binary path.
          let text: string | null = null;
          try {
            text = data.toString('utf-8');
            // Detect U+FFFD (replacement character) presence — that's a sign
            // of malformed UTF-8. We fall back to binary in that case.
            if (text.includes('�')) text = null;
          } catch {
            text = null;
          }

          if (text == null) {
            const ext = filePath.toLowerCase().split('.').pop() ?? '';
            const mimeType = MIME_BY_EXT[ext] ?? 'application/octet-stream';
            const storageKey = `projects/${project.id}/${randomUUID()}-${filePath
              .split('/')
              .pop()}`;
            const meta = await this.blobStorage.put(storageKey, data, mimeType);
            await this.fileRepo.createBinary({
              projectId: project.id,
              path: filePath,
              kind,
              storageKey,
              mimeType: meta.contentType,
              sizeBytes: meta.sizeBytes,
              sha256: meta.sha256,
            });
          } else {
            const sha256 = createHash('sha256').update(text).digest('hex');
            await this.fileRepo.create({
              projectId: project.id,
              path: filePath,
              kind,
              content: text,
              storageMode: 'inline',
              sizeBytes: Buffer.byteLength(text, 'utf-8'),
              sha256,
            });
          }
        }
      }

      if (this.settingsRepo && mainPath) {
        const settings = await this.settingsRepo.findOrCreate(project.id);
        await this.settingsRepo.update(
          new ProjectSettings(
            settings.projectId,
            mainPath,
            settings.compileOptions,
            settings.zoteroConfig,
            new Date(),
          ),
        );
      }
    } catch (err) {
      console.error('[ImportProject] failed mid-import:', err);
      return failure(
        'INTERNAL_ERROR',
        'Lỗi khi giải nén tệp .zip. Dự án có thể đã được tạo nhưng thiếu file; vui lòng xóa và thử lại.',
      );
    }

    return success({ project });
  }
}
