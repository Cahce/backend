/**
 * Update File Use Case
 * 
 * Application layer orchestration for updating a file's content.
 */

import * as crypto from 'node:crypto';
import type { FileRepo } from '../domain/ProjectFile/Ports.js';
import type { ProjectRepo } from '../../projects/domain/Project/Ports.js';
import type { File } from '../domain/ProjectFile/Types.js';
import { FileErrors } from '../domain/ProjectFile/Errors.js';
import { ProjectAuthPolicy, type AuthContext } from '../../projects/domain/Project/Policies.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';

/**
 * Command for updating a file
 */
export interface UpdateFileCommand {
  projectId: string;
  path: string;
  content: string;
  userId: string;
  userRole: 'admin' | 'teacher' | 'student';
}

/**
 * Update File Use Case
 * 
 * Updates a file's content, recomputes size and hash, and updates lastEditedAt.
 */
export class UpdateFileUseCase {
  constructor(
    private readonly FileRepo: FileRepo,
    private readonly ProjectRepo: ProjectRepo,
  ) {}

  async execute(command: UpdateFileCommand): Promise<Result<File>> {
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

      // Recompute size and hash
      const sizeBytes = Buffer.byteLength(command.content, 'utf8');
      const sha256 = crypto.createHash('sha256').update(command.content, 'utf8').digest('hex');

      // Update file via repository
      // Stage 1: storageMode remains inline (no migration to object storage)
      const file = await this.FileRepo.update({
        projectId: command.projectId,
        path: command.path,
        content: command.content,
        sizeBytes,
        sha256,
      });

      return success(file);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi cập nhật tệp');
    }
  }
}
