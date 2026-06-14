/**
 * Get Project Use Case
 * 
 * Application layer orchestration for retrieving a project by ID.
 */

import type { ProjectRepo } from '../domain/Project/Ports.js';
import type { Project } from '../domain/Project/Types.js';
import { ProjectErrors } from '../domain/Project/Errors.js';
import {
  ProjectAuthPolicy,
  type AuthContext,
  type ProjectAccessLevel,
} from '../domain/Project/Policies.js';
import { buildProjectAuthContext } from './ProjectAuthContext.js';
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
 * Caller capabilities returned alongside the project so the frontend can render
 * the correct mode (e.g. read-only workspace for admin oversight). The backend
 * still enforces every mutation independently — this is advisory for the UI.
 */
export interface ProjectAccessView {
  level: ProjectAccessLevel;
  canEdit: boolean;
  canDelete: boolean;
  canManageSettings: boolean;
  canCompileOfficial: boolean;
}

/** Project plus the requesting user's capabilities on it. */
export type ProjectWithAccess = Project & { access: ProjectAccessView };

/**
 * Get Project Use Case
 *
 * Retrieves a project by ID, enforces read authorization, and computes the
 * caller's capabilities.
 */
export class GetProjectUseCase {
  constructor(private readonly projectRepo: ProjectRepo) {}

  async execute(command: GetProjectCommand): Promise<Result<ProjectWithAccess>> {
    try {
      // Find project by ID
      const project = await this.projectRepo.findById(command.projectId);

      if (!project) {
        return failure(ProjectErrors.PROJECT_NOT_FOUND.code, ProjectErrors.PROJECT_NOT_FOUND.message);
      }

      // Enforce authorization (resolves ProjectMember / advisor relations).
      const authContext: AuthContext = await buildProjectAuthContext(
        this.projectRepo,
        project,
        command.userId,
        command.userRole,
      );

      const capabilities = ProjectAuthPolicy.capabilities(project, authContext);

      if (!capabilities.canRead) {
        return failure(ProjectErrors.UNAUTHORIZED.code, ProjectErrors.UNAUTHORIZED.message);
      }

      const access: ProjectAccessView = {
        level: capabilities.level,
        canEdit: capabilities.canEdit,
        canDelete: capabilities.canDelete,
        canManageSettings: capabilities.canManageSettings,
        canCompileOfficial: capabilities.canCompileOfficial,
      };

      return success({ ...project, access });
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi lấy thông tin dự án');
    }
  }
}
