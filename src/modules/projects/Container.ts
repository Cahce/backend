/**
 * Projects Module Container
 * 
 * Centralized dependency wiring for the projects module.
 * Instantiates repositories and use cases with proper dependencies.
 */

import type { PrismaClient } from '../../generated/prisma/index.js';
import type { ProjectRepo } from './domain/Project/Ports.js';
import { ProjectRepoPrisma } from './infra/ProjectRepoPrisma.js';
import { CreateProjectUseCase } from './application/CreateProjectUseCase.js';
import { GetProjectUseCase } from './application/GetProjectUseCase.js';
import { ListProjectsUseCase } from './application/ListProjectsUseCase.js';
import { UpdateProjectUseCase } from './application/UpdateProjectUseCase.js';
import { DeleteProjectUseCase } from './application/DeleteProjectUseCase.js';

/**
 * Projects Module Container
 * 
 * Provides centralized dependency injection for the projects module.
 */
export class ProjectsContainer {
  // Repository (typed as interface for DIP compliance)
  private projectRepo: ProjectRepo;

  // Use Cases
  public createProjectUseCase: CreateProjectUseCase;
  public getProjectUseCase: GetProjectUseCase;
  public listProjectsUseCase: ListProjectsUseCase;
  public updateProjectUseCase: UpdateProjectUseCase;
  public deleteProjectUseCase: DeleteProjectUseCase;

  constructor(prisma: PrismaClient) {
    // Initialize repository
    this.projectRepo = new ProjectRepoPrisma(prisma);

    // Wire use cases
    this.createProjectUseCase = new CreateProjectUseCase(this.projectRepo);
    this.getProjectUseCase = new GetProjectUseCase(this.projectRepo);
    this.listProjectsUseCase = new ListProjectsUseCase(this.projectRepo);
    this.updateProjectUseCase = new UpdateProjectUseCase(this.projectRepo);
    this.deleteProjectUseCase = new DeleteProjectUseCase(this.projectRepo);
  }

  /**
   * Get the project repository instance
   * Useful for cross-module dependencies (e.g., project-files module)
   */
  getProjectRepo(): ProjectRepo {
    return this.projectRepo;
  }
}
