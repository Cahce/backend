/**
 * Mock Project Repository for Unit Testing
 * 
 * Test double that implements ProjectRepo interface for isolated testing.
 */

import type { ProjectRepo } from '../../domain/Project/Ports.js';
import type { Project, CreateProjectData, UpdateProjectData } from '../../domain/Project/Types.js';

/**
 * Mock implementation of ProjectRepo for unit tests
 */
export class MockProjectRepo implements ProjectRepo {
  private projects: Map<string, Project> = new Map();
  private nextId = 1;

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
    this.nextId = 1;
  }

  async create(data: CreateProjectData): Promise<Project> {
    const id = `project-${this.nextId++}`;
    const now = new Date();
    const project: Project = {
      id,
      title: data.title,
      category: data.category,
      ownerId: data.ownerId,
      createdAt: now,
      updatedAt: now,
      lastEditedAt: null,
    };
    this.projects.set(id, project);
    return project;
  }

  async findById(id: string): Promise<Project | null> {
    return this.projects.get(id) || null;
  }

  async listByOwnerId(ownerId: string): Promise<Project[]> {
    const projects = Array.from(this.projects.values())
      .filter(p => p.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return projects;
  }

  async update(data: UpdateProjectData): Promise<Project> {
    const project = this.projects.get(data.projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const updated: Project = {
      ...project,
      title: data.title !== undefined ? data.title : project.title,
      category: data.category !== undefined ? data.category : project.category,
      updatedAt: new Date(),
    };

    this.projects.set(data.projectId, updated);
    return updated;
  }

  async delete(projectId: string): Promise<void> {
    this.projects.delete(projectId);
  }
}
