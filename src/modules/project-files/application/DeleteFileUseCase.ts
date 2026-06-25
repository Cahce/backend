/**
 * Delete File Use Case
 * 
 * Application layer orchestration for deleting a file.
 */

import type { FileRepo } from '../domain/ProjectFile/Ports.js';
import type { ProjectRepo } from '../../projects/domain/Project/Ports.js';
import { FileErrors } from '../domain/ProjectFile/Errors.js';
import { ProjectAuthPolicy, type AuthContext } from '../../projects/domain/Project/Policies.js';
import { buildProjectAuthContext } from '../../projects/application/ProjectAuthContext.js';
import type { BlobStorage } from '../../../shared/storage/BlobStorage.js';
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
    private readonly fileRepo: FileRepo,
    private readonly projectRepo: ProjectRepo,
    // Optional: when wired, the backing blob of a binary file is removed too.
    private readonly blobStorage?: BlobStorage,
  ) {}

  async execute(command: DeleteFileCommand): Promise<Result<void>> {
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

      // Find file by project ID and path
      const existingFile = await this.fileRepo.findByProjectIdAndPath(
        command.projectId,
        command.path,
      );

      if (!existingFile) {
        return failure(FileErrors.FILE_NOT_FOUND.code, FileErrors.FILE_NOT_FOUND.message);
      }

      // Delete the DB record first.
      await this.fileRepo.delete(command.projectId, command.path);

      // Best-effort: remove the backing blob for binary files so deleting a file
      // does not orphan its on-disk object. A failure here must NOT fail the
      // user-visible delete (the row is already gone); the blob can be swept later.
      if (existingFile.storageKey && this.blobStorage) {
        try {
          await this.blobStorage.delete(existingFile.storageKey);
        } catch {
          // ignore — an orphaned blob is preferable to a failed delete
        }
      }

      return success(undefined);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi xóa tệp');
    }
  }
}
