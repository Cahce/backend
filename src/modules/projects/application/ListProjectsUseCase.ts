/**
 * List Projects Use Case
 * 
 * Application layer orchestration for listing projects owned by a user.
 */

import type { ProjectRepo } from '../domain/Project/Ports.js';
import type { Project } from '../domain/Project/Types.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';

/**
 * Command for listing projects
 */
export interface ListProjectsCommand {
  userId: string;
  userRole: 'admin' | 'teacher' | 'student';
}

/**
 * List Projects Use Case
 * 
 * Lists all projects owned by a user, ordered by updatedAt descending.
 * Users can only list their own projects (authorization enforced).
 */
export class ListProjectsUseCase {
  constructor(private readonly projectRepo: ProjectRepo) {}

  async execute(command: ListProjectsCommand): Promise<Result<Project[]>> {
    try {
      // List projects by owner ID
      // Authorization: users can only list their own projects
      const projects = await this.projectRepo.listByOwnerId(command.userId);

      return success(projects);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi lấy danh sách dự án');
    }
  }
}
