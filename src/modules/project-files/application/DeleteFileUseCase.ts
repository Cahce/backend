/**
 * Delete File Use Case
 * 
 * Application layer orchestration for deleting a file.
 */

import type { FileRepo } from '../domain/ProjectFile/Ports.js';
import type { ProjectRepo } from '../../projects/domain/Project/Ports.js';
import { FileErrors } from '../domain/ProjectFile/Errors.js';
import { ProjectAuthPolicy, type AuthContext } from '../../projects/domain/Project/Policies.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';

/**
 * Command for deleting a file
 */
export interface DeleteFileCommand {
  projectId: string;
  path: string;
  userId: string;
  userRole: 'admin' | 'teacher' | 'student';
}

/**
 * Delete File Use Case
 * 
 * Deletes a file from the project.
 * Stage 1: Only deletes database record (inline storage).
 */
export class DeleteFileUseCase {
  constructor(
    private readonly FileRepo: FileRepo,
    private readonly ProjectRepo: ProjectRepo,
  ) {}

  async execute(command: DeleteFileCommand): Promise<Result<void>> {
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

      // Find file by project ID and path
      const existingFile = await this.FileRepo.findByProjectIdAndPath(
        command.projectId,
        command.path,
      );

      if (!existingFile) {
        return failure(FileErrors.FILE_NOT_FOUND.code, FileErrors.FILE_NOT_FOUND.message);
      }

      // Delete file via repository
      // Stage 1: Only delete database record (inline storage)
      await this.FileRepo.delete(command.projectId, command.path);

      return success(undefined);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi xóa tệp');
    }
  }
}
