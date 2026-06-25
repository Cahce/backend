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
import { buildProjectAuthContext } from '../../projects/application/ProjectAuthContext.js';
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
    private readonly fileRepo: FileRepo,
    private readonly projectRepo: ProjectRepo,
  ) {}

  async execute(command: ListFilesCommand): Promise<Result<FileMetadata[]>> {
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

      if (!ProjectAuthPolicy.canRead(project, authContext)) {
        return failure(FileErrors.UNAUTHORIZED.code, FileErrors.UNAUTHORIZED.message);
      }

      // List file metadata only — avoids loading every file's textContent
      // (@db.Text), which the tree discards anyway. Hot path on workspace open.
      const metadata = await this.fileRepo.listMetadataByProjectId(command.projectId);

      return success(metadata);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi lấy danh sách tệp');
    }
  }
}
