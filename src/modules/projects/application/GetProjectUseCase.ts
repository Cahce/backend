/**
 * Get Project Use Case
 * 
 * Application layer orchestration for retrieving a project by ID.
 */

import type { ProjectRepo } from '../domain/Project/Ports.js';
import type { Project } from '../domain/Project/Types.js';
import { ProjectErrors } from '../domain/Project/Errors.js';
import { ProjectAuthPolicy, type AuthContext } from '../domain/Project/Policies.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';

/**
 * Command for getting a project
 */
export interface GetProjectCommand {
  projectId: string;
  userId: string;
  userRole: 'admin' | 'teacher' | 'student';
}

/**
 * Get Project Use Case
 * 
 * Retrieves a project by ID and enforces authorization.
 */
export class GetProjectUseCase {
  constructor(private readonly projectRepo: ProjectRepo) {}

  async execute(command: GetProjectCommand): Promise<Result<Project>> {
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

      if (!ProjectAuthPolicy.canRead(project, authContext)) {
        return failure(ProjectErrors.UNAUTHORIZED.code, ProjectErrors.UNAUTHORIZED.message);
      }

      return success(project);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi lấy thông tin dự án');
    }
  }
}
