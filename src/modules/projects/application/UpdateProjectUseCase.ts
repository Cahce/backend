/**
 * Update Project Use Case
 * 
 * Application layer orchestration for updating a project.
 */

import type { ProjectRepo } from '../domain/Project/Ports.js';
import type { Project, UpdateProjectData } from '../domain/Project/Types.js';
import { ProjectErrors } from '../domain/Project/Errors.js';
import { ProjectAuthPolicy, type AuthContext } from '../domain/Project/Policies.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';

/**
 * Command for updating a project
 */
export interface UpdateProjectCommand {
  projectId: string;
  title?: string;
  category?: string;
  userId: string;
  userRole: 'admin' | 'teacher' | 'student';
}

/**
 * Update Project Use Case
 * 
 * Updates a project and enforces authorization.
 */
export class UpdateProjectUseCase {
  constructor(private readonly projectRepo: ProjectRepo) {}

  async execute(command: UpdateProjectCommand): Promise<Result<Project>> {
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

      if (!ProjectAuthPolicy.canWrite(project, authContext)) {
        return failure(ProjectErrors.UNAUTHORIZED.code, ProjectErrors.UNAUTHORIZED.message);
      }

      // Validate title if provided
      if (command.title !== undefined) {
        if (!command.title || command.title.trim().length === 0) {
          return failure(ProjectErrors.VALIDATION_ERROR.code, 'Tiêu đề dự án không được để trống');
        }
      }

      // Update project data
      const data: UpdateProjectData = {
        projectId: command.projectId,
        title: command.title?.trim(),
        category: command.category as any, // Type assertion for enum
      };

      // Update project via repository
      const updatedProject = await this.projectRepo.update(data);
      return success(updatedProject);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi cập nhật dự án');
    }
  }
}
