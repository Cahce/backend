
import type { Project, CreateProjectData, UpdateProjectData } from './Types.js';

export interface ProjectRepo {
  create(data: CreateProjectData): Promise<Project>;

  findById(id: string): Promise<Project | null>;

  listByOwnerId(ownerId: string): Promise<Project[]>;

  update(data: UpdateProjectData): Promise<Project>;

  delete(projectId: string): Promise<void>;

  getEffectiveAccess(
    projectId: string,
    userId: string,
  ): Promise<{ membershipRole: 'editor' | 'viewer' | null; isAdvisor: boolean }>;
}
