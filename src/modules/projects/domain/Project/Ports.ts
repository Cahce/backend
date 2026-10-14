
import type { Project, CreateProjectData, UpdateProjectData } from './Types.js';

export interface ProjectRepo {
  create(data: CreateProjectData): Promise<Project>;

  findById(id: string): Promise<Project | null>;

  listByOwnerId(ownerId: string): Promise<Project[]>;

  update(data: UpdateProjectData): Promise<Project>;

  delete(projectId: string, actorId?: string): Promise<void>;

  /**
   * Collect every blob storage key owned by a project (uploaded files +
   * compiled artifacts) so the caller can free the physical blobs after the
   * project — and its cascade-deleted rows — are removed from the database.
   */
  listStorageKeys(projectId: string): Promise<string[]>;

  getEffectiveAccess(
    projectId: string,
    userId: string,
  ): Promise<{ membershipRole: 'editor' | 'commenter' | 'viewer' | null; isAdvisor: boolean;
    isActive?: boolean; version?: string; validUntil?: string | null }>;
}
