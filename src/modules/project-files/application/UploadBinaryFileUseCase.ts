/**
 * UploadBinaryFile Use Case
 *
 * Persists a binary file (image / font / PDF / etc) into a project.
 * Flow:
 *   1. Authorize: caller must be the project owner or a member.
 *   2. Validate: sanitize path + reject forbidden extensions + check declared MIME.
 *   3. Reject duplicates: path must not already exist (caller deletes first).
 *   4. Stream the upload to BlobStorage — this also computes sha256 + sizeBytes.
 *   5. Persist the File row via FileRepo.createBinary.
 */

import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import type { FileRepo } from "../domain/ProjectFile/Ports.js";
import { FileKind } from "../domain/ProjectFile/Types.js";
import type { File } from "../domain/ProjectFile/Types.js";
import type { BlobStorage } from "../../../shared/storage/BlobStorage.js";
import { detectKindFromPath } from "../domain/FileKindPolicy.js";
import {
  isAllowedMimeType,
  hasForbiddenExtension,
} from "../domain/AllowedMimeTypes.js";
import { validateProjectFilePath, InvalidPathError } from "../domain/PathValidator.js";
import type { ProjectWriteAccessPolicy } from "../../projects/domain/access/ProjectAccessPolicies.js";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class InvalidMimeError extends Error {
  constructor(public readonly declaredMimeType: string) {
    super(`MIME type not allowed: ${declaredMimeType}`);
    this.name = "InvalidMimeError";
  }
}

export class ForbiddenExtensionError extends Error {
  constructor(public readonly path: string) {
    super(`Phần mở rộng tệp này không được phép`);
    this.name = "ForbiddenExtensionError";
  }
}

export class FileExistsError extends Error {
  constructor(public readonly path: string) {
    super(`Tệp đã tồn tại tại ${path}`);
    this.name = "FileExistsError";
  }
}

export class ProjectAccessDeniedError extends Error {
  constructor() {
    super("Bạn không có quyền truy cập project này");
    this.name = "ProjectAccessDeniedError";
  }
}

// Re-export for convenience
export { InvalidPathError };

// ---------------------------------------------------------------------------
// Command + Result
// ---------------------------------------------------------------------------

export interface UploadBinaryFileCommand {
  projectId: string;
  userId: string;
  path: string;
  kind?: FileKind;
  stream: Readable;
  declaredMimeType: string;
}

export type UploadBinaryFileResult = File;

// ---------------------------------------------------------------------------
// Use case
// ---------------------------------------------------------------------------

export class UploadBinaryFileUseCase {
  constructor(
    private readonly fileRepo: FileRepo,
    private readonly blobStorage: BlobStorage,
    private readonly projectAccess: ProjectWriteAccessPolicy,
  ) {}

  async execute(cmd: UploadBinaryFileCommand): Promise<UploadBinaryFileResult> {
    // 1. Authorization. The compile module's policy throws on denial — we
    //    re-wrap into our typed error so the HTTP layer maps to 403 cleanly.
    try {
      await this.projectAccess.requireWriteAccess(cmd.projectId, cmd.userId);
    } catch (err) {
      // Bubble up project-not-found unchanged; map access-denied to typed.
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("PROJECT_NOT_FOUND")) throw err;
      throw new ProjectAccessDeniedError();
    }

    // 2. Path validation + extension check.
    const normalisedPath = validateProjectFilePath(cmd.path);
    if (hasForbiddenExtension(normalisedPath)) {
      throw new ForbiddenExtensionError(normalisedPath);
    }

    // 3. MIME allow-list.
    if (!isAllowedMimeType(cmd.declaredMimeType)) {
      throw new InvalidMimeError(cmd.declaredMimeType);
    }

    // 4. Reject duplicates.
    if (await this.fileRepo.exists(cmd.projectId, normalisedPath)) {
      throw new FileExistsError(normalisedPath);
    }

    // 5. Detect kind if caller didn't supply one.
    const kind = cmd.kind ?? detectKindFromPath(normalisedPath);

    // 6. Stream into blob storage. The key contains a UUID prefix so two
    //    uploads with the same filename don't collide; the human-readable
    //    suffix is preserved for ops debugging.
    const basename = normalisedPath.split("/").pop() ?? "file";
    const storageKey = `projects/${cmd.projectId}/${randomUUID()}-${basename}`;
    const metadata = await this.blobStorage.put(
      storageKey,
      cmd.stream,
      cmd.declaredMimeType,
    );

    // 7. Persist row.
    const file = await this.fileRepo.createBinary({
      projectId: cmd.projectId,
      path: normalisedPath,
      kind,
      storageKey,
      mimeType: metadata.contentType,
      sizeBytes: metadata.sizeBytes,
      sha256: metadata.sha256,
    });

    return file;
  }
}
