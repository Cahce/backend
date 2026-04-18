/**
 * Create Project Use Case
 * 
 * Application layer orchestration for creating a new project.
 */

import type { ProjectRepo } from '../domain/Project/Ports.js';
import type { Project, CreateProjectData } from '../domain/Project/Types.js';
import { ProjectErrors } from '../domain/Project/Errors.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';

/**
 * Command for creating a project
 */
export interface CreateProjectCommand {
  title: string;
  category: string;
  userId: string; // for authorization and ownership
}

/**
 * Create Project Use Case
 * 
 * Validates input, enforces authorization, and creates a new project.
 */
export class CreateProjectUseCase {
  constructor(private readonly projectRepo: ProjectRepo) {}

  async execute(command: CreateProjectCommand): Promise<Result<Project>> {
    try {
      // Validate title is non-empty
      if (!command.title || command.title.trim().length === 0) {
        return failure(ProjectErrors.VALIDATION_ERROR.code, 'Tiêu đề dự án không được để trống');
      }

      // Create project data
      const data: CreateProjectData = {
        title: command.title.trim(),
        category: command.category as any, // Type assertion for enum
        ownerId: command.userId,
      };

      // Create project via repository
      const project = await this.projectRepo.create(data);
      return success(project);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi tạo dự án');
    }
  }
}
