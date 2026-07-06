
import { createHash, randomUUID } from 'node:crypto';

import { detectMainPath } from './detectMainPath.js';
import {
  ArchiveExtractionError,
  extractArchiveEntries,
  type PendingEntry,
} from './extractArchive.js';
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

const DEFAULT_MAX_EXPANDED = 200 * 1024 * 1024;
const DEFAULT_MAX_PER_FILE = 50 * 1024 * 1024;

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
  archiveBuffer: Buffer;
  filename?: string;
  category?: TemplateCategory;
  title?: string;
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
  const match = toml.match(/^\s*name\s*=\s*"([^"\n]+)"/m);
  return match?.[1]?.trim() || null;
}

function titleFromArchiveFilename(filename: string | undefined): string | null {
  if (!filename) return null;
  const base = filename.replace(/\.(tar\.gz|tgz|zip|7z|rar|tar|gz)$/i, '');
  return base.trim() || null;
}

interface ArchiveRootNormalization {
  entries: PendingEntry[];
  strippedRoot: string | null;
}

function isTypstSource(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.typ');
}

function hasTypstProjectMarker(paths: string[]): boolean {
  const pathSet = new Set(paths);
  if (pathSet.has('project.toml')) return true;
  if (pathSet.has('typst.toml')) return true;
  if (pathSet.has('main.typ')) return true;

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

function readManifestToml(entries: PendingEntry[], fileName: string): string | null {
  const manifest = entries.find(
    (entry) => entry.path === fileName || entry.path.endsWith(`/${fileName}`),
  );
  return manifest ? decodeUtf8(manifest.data) : null;
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
    let pending: PendingEntry[];
    try {
      pending = extractArchiveEntries(
        command.archiveBuffer,
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

    const tomlContent = readManifestToml(pending, 'project.toml');
    const mainPath = detectMainPath(
      pending.map(({ path: filePath, data }) => ({
        path: filePath,
        content: isTypstSource(filePath) ? decodeUtf8(data) : null,
      })),
      {
        typstToml: readManifestToml(pending, 'typst.toml'),
        projectToml: tomlContent,
      },
    );

    const title =
      command.title?.trim() ||
      pickTitleFromToml(tomlContent) ||
      titleFromArchiveFilename(command.filename) ||
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
          let text: string | null = null;
          try {
            text = data.toString('utf-8');
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
            settings.openalexConfig,
            new Date(),
          ),
        );
      }
    } catch (err) {
      console.error('[ImportProject] failed mid-import:', err);
      return failure(
        'INTERNAL_ERROR',
        'Lỗi khi lưu tệp từ tệp nén. Dự án có thể đã được tạo nhưng thiếu file; vui lòng xóa và thử lại.',
      );
    }

    return success({ project });
  }
}
