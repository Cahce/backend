/**
 * Import Project Use Case
 *
 * Accepts a ZIP buffer (already loaded from multipart upload), validates its
 * shape, creates a new project owned by the caller, and persists every entry
 * as either an inline text file or a binary blob.
 *
 * Security & limits:
 *   - Rejects path traversal (`..`, absolute paths).
 *   - Skips symlinks and directory entries.
 *   - Aborts with `ZIP_PAYLOAD_TOO_LARGE` if the **uncompressed** total exceeds
 *     `maxExpandedBytes` (default 200 MB) or any single entry exceeds
 *     `maxPerFileBytes` (default 20 MB). Defends against zip-bomb.
 *   - Rejects malformed archives (`ZIP_MALFORMED`).
 *
 * Atomicity: project is created first, then files are appended. On per-file
 * failure mid-flight the project is left in a partial state (the caller may
 * delete it). A full transactional rollback would require lower-level
 * coordination across `projectRepo`, `fileRepo`, and `blobStorage` — out of
 * scope for the MVP; thesis-scale imports rarely fail mid-stream.
 */

import AdmZip from 'adm-zip';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';

import type { ProjectRepo } from '../domain/Project/Ports.js';
import { TemplateCategory, type Project } from '../domain/Project/Types.js';
import type { FileRepo } from '../../project-files/domain/ProjectFile/Ports.js';
import {
  detectKindFromPath,
  isBinaryKind,
} from '../../project-files/domain/FileKindPolicy.js';
import type { BlobStorage } from '../../../shared/storage/BlobStorage.js';
import { ProjectErrors } from '../domain/Project/Errors.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';

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
  zipBuffer: Buffer;
}

export interface ImportProjectResult {
  project: Project;
}

function isUnsafePath(entryPath: string): boolean {
  // Normalise to POSIX separators (zips commonly use `/`).
  const normalised = entryPath.replace(/\\/g, '/');
  if (normalised.startsWith('/')) return true;
  if (/^[a-zA-Z]:[\\/]/.test(normalised)) return true; // Windows drive
  const parts = normalised.split('/');
  if (parts.includes('..')) return true;
  return false;
}

function pickTitleFromToml(toml: string | null): string | null {
  if (!toml) return null;
  // Very small parse: look for a top-level `name = "..."` line.
  const match = toml.match(/^\s*name\s*=\s*"([^"\n]+)"/m);
  return match?.[1]?.trim() || null;
}

export class ImportProjectUseCase {
  constructor(
    private readonly projectRepo: ProjectRepo,
    private readonly fileRepo: FileRepo,
    private readonly blobStorage: BlobStorage,
    private readonly maxExpandedBytes: number = DEFAULT_MAX_EXPANDED,
    private readonly maxPerFileBytes: number = DEFAULT_MAX_PER_FILE,
  ) {}

  async execute(
    command: ImportProjectCommand,
  ): Promise<Result<ImportProjectResult>> {
    // --- Parse + validate zip ------------------------------------------------
    let zip: AdmZip;
    try {
      zip = new AdmZip(command.zipBuffer);
    } catch {
      return failure(
        ProjectErrors.ZIP_MALFORMED.code,
        ProjectErrors.ZIP_MALFORMED.message,
      );
    }

    const entries = zip.getEntries();
    interface PendingEntry {
      path: string;
      data: Buffer;
    }
    const pending: PendingEntry[] = [];
    let totalExpanded = 0;
    let tomlContent: string | null = null;

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const rawName = entry.entryName;

      // Symlink detection — adm-zip exposes the external file attributes via
      // header. The upper 16 bits are UNIX mode; `0xA000` = symlink.
      const unixMode = (entry.header.attr >>> 16) & 0xffff;
      if ((unixMode & 0xf000) === 0xa000) {
        // Skip silently — symlinks have no place in our editor.
        continue;
      }

      if (isUnsafePath(rawName)) {
        return failure(
          ProjectErrors.ZIP_PATH_TRAVERSAL.code,
          `${ProjectErrors.ZIP_PATH_TRAVERSAL.message}: ${rawName}`,
        );
      }

      const normalised = path.posix.normalize(rawName).replace(/^\/+/, '');
      if (!normalised || normalised === '.' || normalised === '..') continue;

      const data = entry.getData();
      if (data.length > this.maxPerFileBytes) {
        return failure(
          ProjectErrors.ZIP_PAYLOAD_TOO_LARGE.code,
          `${ProjectErrors.ZIP_PAYLOAD_TOO_LARGE.message} (${normalised} > ${this.maxPerFileBytes} bytes)`,
        );
      }
      totalExpanded += data.length;
      if (totalExpanded > this.maxExpandedBytes) {
        return failure(
          ProjectErrors.ZIP_PAYLOAD_TOO_LARGE.code,
          `${ProjectErrors.ZIP_PAYLOAD_TOO_LARGE.message} (tổng > ${this.maxExpandedBytes} bytes)`,
        );
      }

      pending.push({ path: normalised, data });

      if (normalised === 'project.toml' || normalised.endsWith('/project.toml')) {
        try {
          tomlContent = data.toString('utf-8');
        } catch {
          // Non-UTF-8 toml is unusual; ignore.
        }
      }
    }

    // --- Create project ------------------------------------------------------
    const title =
      pickTitleFromToml(tomlContent) ??
      `Imported ${new Date().toISOString().slice(0, 10)}`;

    let project: Project;
    try {
      project = await this.projectRepo.create({
        title,
        category: TemplateCategory.Other,
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
