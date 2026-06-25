/**
 * Get File Use Case
 * 
 * Application layer orchestration for retrieving a file by path.
 */

import type { FileRepo } from '../domain/ProjectFile/Ports.js';
import type { ProjectRepo } from '../../projects/domain/Project/Ports.js';
import type { File } from '../domain/ProjectFile/Types.js';
import { FileErrors } from '../domain/ProjectFile/Errors.js';
import { ProjectAuthPolicy, type AuthContext } from '../../projects/domain/Project/Policies.js';
import { buildProjectAuthContext } from '../../projects/application/ProjectAuthContext.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';

/**
 * Command for getting a file
 */
export interface GetFileCommand {
  projectId: string;
  path: string;
  userId: string;
  userRole: 'admin' | 'teacher' | 'student';
}

/**
 * Get File Use Case
 * 
 * Retrieves a file by project ID and path, including content.
 */
export class GetFileUseCase {
  constructor(
    private readonly fileRepo: FileRepo,
    private readonly projectRepo: ProjectRepo,
  ) {}

  async execute(command: GetFileCommand): Promise<Result<File>> {
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

      // Find file by project ID and path
      const file = await this.fileRepo.findByProjectIdAndPath(command.projectId, command.path);

      if (!file) {
        return failure(FileErrors.FILE_NOT_FOUND.code, FileErrors.FILE_NOT_FOUND.message);
      }

      return success(file);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi lấy thông tin tệp');
    }
  }
}
