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
import type { Result } from './Types.js';
import { success, failure } from './Types.js';

/**
 * Command for creating a file
 */
export interface CreateFileCommand {
  projectId: string;
  path: string;
  kind: FileKind;
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

      // Enforce authorization
      const authContext: AuthContext = {
        userId: command.userId,
        role: command.userRole,
      };

      if (!ProjectAuthPolicy.canWrite(project, authContext)) {
        return failure(FileErrors.UNAUTHORIZED.code, FileErrors.UNAUTHORIZED.message);
      }

      // Validate path format
      const pathValidation = this.validatePath(command.path);
      if (!pathValidation.valid) {
        return failure(FileErrors.INVALID_FILE_PATH.code, pathValidation.reason!);
      }

      // Check if file already exists at path
      const existingFile = await this.fileRepo.findByProjectIdAndPath(
        command.projectId,
        command.path,
      );

      if (existingFile) {
        return failure(FileErrors.FILE_ALREADY_EXISTS.code, FileErrors.FILE_ALREADY_EXISTS.message);
      }

      // Compute size and hash
      const sizeBytes = Buffer.byteLength(command.content, 'utf8');
      const sha256 = crypto.createHash('sha256').update(command.content, 'utf8').digest('hex');

      // Apply storage policy
      const storageMode = StoragePolicy.determineStorageMode(sizeBytes, command.kind);

      // Create file via repository
      const file = await this.fileRepo.create({
        projectId: command.projectId,
        path: command.path,
        kind: command.kind,
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

  /**
   * Validate file path format
   * Rejects: ../, ./, absolute paths, empty paths
   */
  private validatePath(path: string): { valid: boolean; reason?: string } {
    if (!path || path.trim().length === 0) {
      return { valid: false, reason: 'Đường dẫn không được để trống' };
    }

    if (path.includes('../')) {
      return { valid: false, reason: 'Đường dẫn không được chứa ../' };
    }

    if (path.startsWith('./')) {
      return { valid: false, reason: 'Đường dẫn không được bắt đầu bằng ./' };
    }

    if (path.startsWith('/')) {
      return { valid: false, reason: 'Đường dẫn không được là đường dẫn tuyệt đối' };
    }

    return { valid: true };
  }
}
