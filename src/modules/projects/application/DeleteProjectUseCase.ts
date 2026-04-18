/**
 * Delete Project Use Case
 * 
 * Application layer orchestration for deleting a project.
 */

import type { ProjectRepo } from '../domain/Project/Ports.js';
import { ProjectErrors } from '../domain/Project/Errors.js';
import { ProjectAuthPolicy, type AuthContext } from '../domain/Project/Policies.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';

/**
 * Command for deleting a project
 */
export interface DeleteProjectCommand {
  projectId: string;
  userId: string;
  userRole: 'admin' | 'teacher' | 'student';
}

/**
 * Delete Project Use Case
 * 
 * Deletes a project and enforces authorization.
 * Database cascade handles File record removal.
 */
export class DeleteProjectUseCase {
  constructor(private readonly projectRepo: ProjectRepo) {}

  async execute(command: DeleteProjectCommand): Promise<Result<void>> {
    try {
      // Find project by ID
      const project = await this.projectRepo.findById(command.projectId);

      if (!project) {
        return failure(ProjectErrors.PROJECT_NOT_FOUND.code, ProjectErrors.PROJECT_NOT_FOUND.message);
      }

      // Enforce authorization
      const authContext: AuthContext = {
        userId: command.userId,
        role: command.userRole,
      };

      if (!ProjectAuthPolicy.canDelete(project, authContext)) {
        return failure(ProjectErrors.UNAUTHORIZED.code, ProjectErrors.UNAUTHORIZED.message);
      }

      // Delete project via repository
      // Database cascade will handle File record removal
      await this.projectRepo.delete(command.projectId);
      return success(undefined);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi xóa dự án');
    }
  }
}
