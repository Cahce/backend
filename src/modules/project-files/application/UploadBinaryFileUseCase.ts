
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

export { InvalidPathError };


export interface UploadBinaryFileCommand {
  projectId: string;
  userId: string;
  path: string;
  kind?: FileKind;
  stream: Readable;
  declaredMimeType: string;
}

export type UploadBinaryFileResult = File;


export class UploadBinaryFileUseCase {
  constructor(
    private readonly fileRepo: FileRepo,
    private readonly blobStorage: BlobStorage,
    private readonly projectAccess: ProjectWriteAccessPolicy,
  ) {}

  async execute(cmd: UploadBinaryFileCommand): Promise<UploadBinaryFileResult> {
    try {
      await this.projectAccess.requireWriteAccess(cmd.projectId, cmd.userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("PROJECT_NOT_FOUND")) throw err;
      throw new ProjectAccessDeniedError();
    }

    const normalisedPath = validateProjectFilePath(cmd.path);
    if (hasForbiddenExtension(normalisedPath)) {
      throw new ForbiddenExtensionError(normalisedPath);
    }

    if (!isAllowedMimeType(cmd.declaredMimeType)) {
      throw new InvalidMimeError(cmd.declaredMimeType);
    }

    if (await this.fileRepo.exists(cmd.projectId, normalisedPath)) {
      throw new FileExistsError(normalisedPath);
    }

    const kind = cmd.kind ?? detectKindFromPath(normalisedPath);

    const basename = normalisedPath.split("/").pop() ?? "file";
    const storageKey = `projects/${cmd.projectId}/${randomUUID()}-${basename}`;
    const metadata = await this.blobStorage.put(
      storageKey,
      cmd.stream,
      cmd.declaredMimeType,
    );

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
