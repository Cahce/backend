/**
 * Create File Use Case
 * 
 * Application layer orchestration for creating a new file.
 */

import * as crypto from 'node:crypto';
import type { FileRepo } from '../domain/ProjectFile/Ports.js';
import type { ProjectRepo } from '../../projects/domain/Project/Ports.js';
import type { File, FileKind } from '../domain/ProjectFile/Types.js';
import { FileErrors } from '../domain/ProjectFile/Errors.js';
import { StoragePolicy } from '../domain/ProjectFile/Policies.js';
import { ProjectAuthPolicy, type AuthContext } from '../../projects/domain/Project/Policies.js';
import { buildProjectAuthContext } from '../../projects/application/ProjectAuthContext.js';
import { detectKindFromPath } from '../domain/FileKindPolicy.js';
import { validateProjectFilePath, InvalidPathError } from '../domain/PathValidator.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';

/**
 * Command for creating a file
 */
export interface CreateFileCommand {
  projectId: string;
  path: string;
  kind?: FileKind; // Optional - will be auto-detected from path if not provided
  content: string;
  mimeType?: string;
  userId: string;
  userRole: 'admin' | 'teacher' | 'student';
}

/**
 * Create File Use Case
 * 
 * Creates a new file with validation, authorization, and storage policy application.
 */
export class CreateFileUseCase {
  constructor(
    private readonly fileRepo: FileRepo,
    private readonly projectRepo: ProjectRepo,
  ) {}

  async execute(command: CreateFileCommand): Promise<Result<File>> {
    try {
      // Verify project exists
      const project = await this.projectRepo.findById(command.projectId);

      if (!project) {
        return failure(FileErrors.PROJECT_NOT_FOUND.code, FileErrors.PROJECT_NOT_FOUND.message);
      }

      // Enforce authorization (resolves ProjectMember / advisor relations).
      const authContext: AuthContext = await buildProjectAuthContext(
        this.projectRepo,
        project,
        command.userId,
        command.userRole,
      );

      if (!ProjectAuthPolicy.canWrite(project, authContext)) {
        return failure(FileErrors.UNAUTHORIZED.code, FileErrors.UNAUTHORIZED.message);
      }

      // Validate + normalise path via the domain PathValidator (single source
      // of truth; rejects backslashes, control chars, standalone '..', etc.).
      let normalizedPath: string;
      try {
        normalizedPath = validateProjectFilePath(command.path);
      } catch (err) {
        if (err instanceof InvalidPathError) {
          return failure(FileErrors.INVALID_FILE_PATH.code, err.message);
        }
        throw err;
      }

      // Check if file already exists at path
      const existingFile = await this.fileRepo.findByProjectIdAndPath(
        command.projectId,
        normalizedPath,
      );

      if (existingFile) {
        return failure(FileErrors.FILE_PATH_CONFLICT.code, FileErrors.FILE_PATH_CONFLICT.message);
      }

      // Compute size and hash
      const sizeBytes = Buffer.byteLength(command.content, 'utf8');
      const sha256 = crypto.createHash('sha256').update(command.content, 'utf8').digest('hex');

      // Determine file kind (use provided kind or auto-detect from path)
      const fileKind = command.kind ?? detectKindFromPath(normalizedPath);

      // Apply storage policy
      const storageMode = StoragePolicy.determineStorageMode(sizeBytes, fileKind);

      // Create file via repository
      const file = await this.fileRepo.create({
        projectId: command.projectId,
        path: normalizedPath,
        kind: fileKind,
        content: command.content,
        mimeType: command.mimeType,
        storageMode,
        sizeBytes,
        sha256,
      });

      return success(file);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi tạo tệp');
    }
  }
}
