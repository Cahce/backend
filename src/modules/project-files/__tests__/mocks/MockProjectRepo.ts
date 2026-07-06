
import type { ProjectRepo } from '../../../projects/domain/Project/Ports.js';
import type { Project, CreateProjectData, UpdateProjectData } from '../../../projects/domain/Project/Types.js';

export class MockProjectRepo implements ProjectRepo {
  private projects: Map<string, Project> = new Map();

  setProjects(projects: Project[]): void {
    this.projects.clear();
    for (const project of projects) {
      this.projects.set(project.id, project);
    }
  }

  clear(): void {
    this.projects.clear();
  }

  async create(_data: CreateProjectData): Promise<Project> {
    throw new Error('Not implemented in mock');
  }

  async findById(id: string): Promise<Project | null> {
    return this.projects.get(id) || null;
  }

  async listByOwnerId(_ownerId: string): Promise<Project[]> {
    throw new Error('Not implemented in mock');
  }

  async update(_data: UpdateProjectData): Promise<Project> {
    throw new Error('Not implemented in mock');
  }

  async delete(_projectId: string): Promise<void> {
    throw new Error('Not implemented in mock');
  }

  async getEffectiveAccess(
    _projectId: string,
    _userId: string,
  ): Promise<{ membershipRole: 'editor' | 'viewer' | null; isAdvisor: boolean }> {
    return { membershipRole: null, isAdvisor: false };
  }
}
