/**
 * Rename File Use Case
 * 
 * Application layer orchestration for renaming a file.
 */

import type { FileRepo } from '../domain/ProjectFile/Ports.js';
import type { ProjectRepo } from '../../projects/domain/Project/Ports.js';
import type { File } from '../domain/ProjectFile/Types.js';
import { FileErrors } from '../domain/ProjectFile/Errors.js';
import { ProjectAuthPolicy, type AuthContext } from '../../projects/domain/Project/Policies.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';

/**
 * Command for renaming a file
 */
export interface RenameFileCommand {
  projectId: string;
  oldPath: string;
  newPath: string;
  userId: string;
  userRole: 'admin' | 'teacher' | 'student';
}

/**
 * Rename File Use Case
 * 
 * Renames a file, preserving all content and metadata.
 */
export class RenameFileUseCase {
  constructor(
    private readonly FileRepo: FileRepo,
    private readonly ProjectRepo: ProjectRepo,
  ) {}

  async execute(command: RenameFileCommand): Promise<Result<File>> {
    try {
      // Verify project exists
      const project = await this.ProjectRepo.findById(command.projectId);

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

      // Verify file exists at oldPath
      const existingFile = await this.FileRepo.findByProjectIdAndPath(
        command.projectId,
        command.oldPath,
      );

      if (!existingFile) {
        return failure(FileErrors.FILE_NOT_FOUND.code, FileErrors.FILE_NOT_FOUND.message);
      }

      // Validate newPath format
      const pathValidation = this.validatePath(command.newPath);
      if (!pathValidation.valid) {
        return failure(FileErrors.INVALID_FILE_PATH.code, pathValidation.reason!);
      }

      // Check if file already exists at newPath
      const fileAtNewPath = await this.FileRepo.findByProjectIdAndPath(
        command.projectId,
        command.newPath,
      );

      if (fileAtNewPath) {
        return failure(FileErrors.FILE_ALREADY_EXISTS.code, FileErrors.FILE_ALREADY_EXISTS.message);
      }

      // Rename file via repository
      const file = await this.FileRepo.rename({
        projectId: command.projectId,
        oldPath: command.oldPath,
        newPath: command.newPath,
      });

      return success(file);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi đổi tên tệp');
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
