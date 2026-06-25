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
import { buildProjectAuthContext } from '../../projects/application/ProjectAuthContext.js';
import { validateProjectFilePath, InvalidPathError } from '../domain/PathValidator.js';
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
    private readonly fileRepo: FileRepo,
    private readonly projectRepo: ProjectRepo,
  ) {}

  async execute(command: RenameFileCommand): Promise<Result<File>> {
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

      // Verify file exists at oldPath
      const existingFile = await this.fileRepo.findByProjectIdAndPath(
        command.projectId,
        command.oldPath,
      );

      if (!existingFile) {
        return failure(FileErrors.FILE_NOT_FOUND.code, FileErrors.FILE_NOT_FOUND.message);
      }

      // Validate + normalise newPath via the domain PathValidator (single
      // source of truth; rejects backslashes, control chars, standalone '..').
      let normalizedNewPath: string;
      try {
        normalizedNewPath = validateProjectFilePath(command.newPath);
      } catch (err) {
        if (err instanceof InvalidPathError) {
          return failure(FileErrors.INVALID_FILE_PATH.code, err.message);
        }
        throw err;
      }

      // Check if file already exists at newPath
      const fileAtNewPath = await this.fileRepo.findByProjectIdAndPath(
        command.projectId,
        normalizedNewPath,
      );

      if (fileAtNewPath) {
        return failure(FileErrors.RENAME_TARGET_EXISTS.code, FileErrors.RENAME_TARGET_EXISTS.message);
      }

      // Rename file via repository
      const file = await this.fileRepo.rename({
        projectId: command.projectId,
        oldPath: command.oldPath,
        newPath: normalizedNewPath,
      });

      return success(file);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi đổi tên tệp');
    }
  }
}
