
import type { ProjectRepo } from '../domain/Project/Ports.js';
import type { Project } from '../domain/Project/Types.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';

export interface ListProjectsCommand {
  userId: string;
  userRole: 'admin' | 'teacher' | 'student';
}

export class ListProjectsUseCase {
  constructor(private readonly projectRepo: ProjectRepo) {}

  async execute(command: ListProjectsCommand): Promise<Result<Project[]>> {
    try {
      const projects = await this.projectRepo.listByOwnerId(command.userId);

      return success(projects);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi lấy danh sách dự án');
    }
  }
}
