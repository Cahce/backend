/**
 * List Files Use Case
 * 
 * Application layer orchestration for listing files in a project.
 */

import type { FileRepo } from '../domain/ProjectFile/Ports.js';
import type { ProjectRepo } from '../../projects/domain/Project/Ports.js';
import type { FileMetadata } from '../domain/ProjectFile/Types.js';
import { FileErrors } from '../domain/ProjectFile/Errors.js';
import { ProjectAuthPolicy, type AuthContext } from '../../projects/domain/Project/Policies.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';

/**
 * Command for listing files
 */
export interface ListFilesCommand {
  projectId: string;
  userId: string;
  userRole: 'admin' | 'teacher' | 'student';
}

/**
 * List Files Use Case
 * 
 * Lists all files in a project, ordered by path alphabetically.
 * Excludes textContent and storageKey from response.
 */
export class ListFilesUseCase {
  constructor(
    private readonly FileRepo: FileRepo,
    private readonly ProjectRepo: ProjectRepo,
  ) {}

  async execute(command: ListFilesCommand): Promise<Result<FileMetadata[]>> {
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

      if (!ProjectAuthPolicy.canRead(project, authContext)) {
        return failure(FileErrors.UNAUTHORIZED.code, FileErrors.UNAUTHORIZED.message);
      }

      // List files by project ID
      const files = await this.FileRepo.listByProjectId(command.projectId);

      // Map to FileMetadata (exclude textContent and storageKey)
      const metadata: FileMetadata[] = files.map((file) => ({
        id: file.id,
        projectId: file.projectId,
        path: file.path,
        kind: file.kind,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        lastEditedAt: file.lastEditedAt,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      }));

      return success(metadata);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi lấy danh sách tệp');
    }
  }
}
