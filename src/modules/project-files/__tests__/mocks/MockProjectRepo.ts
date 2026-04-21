/**
 * Mock Project Repository for Unit Testing (Project-Files Module)
 * 
 * Simplified mock for project-files tests that only need basic project existence checks.
 */

import type { ProjectRepo } from '../../../projects/domain/Project/Ports.js';
import type { Project, CreateProjectData, UpdateProjectData } from '../../../projects/domain/Project/Types.js';

/**
 * Mock implementation of ProjectRepo for project-files unit tests
 */
export class MockProjectRepo implements ProjectRepo {
  private projects: Map<string, Project> = new Map();

  /**
   * Configure mock to return specific projects
   */
  setProjects(projects: Project[]): void {
    this.projects.clear();
    for (const project of projects) {
      this.projects.set(project.id, project);
    }
  }

  /**
   * Clear all mock data
   */
  clear(): void {
    this.projects.clear();
  }

  async create(data: CreateProjectData): Promise<Project> {
    throw new Error('Not implemented in mock');
  }

  async findById(id: string): Promise<Project | null> {
    return this.projects.get(id) || null;
  }

  async listByOwnerId(ownerId: string): Promise<Project[]> {
    throw new Error('Not implemented in mock');
  }

  async update(data: UpdateProjectData): Promise<Project> {
    throw new Error('Not implemented in mock');
  }

  async delete(projectId: string): Promise<void> {
    throw new Error('Not implemented in mock');
  }
}
