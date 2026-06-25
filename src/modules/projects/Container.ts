/**
 * Projects Module Container
 * 
 * Centralized dependency wiring for the projects module.
 * Instantiates repositories and use cases with proper dependencies.
 */

import type { PrismaClient } from '../../generated/prisma/index.js';
import type { ProjectRepo } from './domain/Project/Ports.js';
import type { ProjectSettingsRepository } from './domain/ProjectSettingsRepository.js';
import { ProjectRepoPrisma } from './infra/ProjectRepoPrisma.js';
import { PrismaProjectSettingsRepository } from './infra/PrismaProjectSettingsRepository.js';
import { CreateProjectUseCase } from './application/CreateProjectUseCase.js';
import { GetProjectUseCase } from './application/GetProjectUseCase.js';
import { ListProjectsUseCase } from './application/ListProjectsUseCase.js';
import { UpdateProjectUseCase } from './application/UpdateProjectUseCase.js';
import { DeleteProjectUseCase } from './application/DeleteProjectUseCase.js';
import { GetProjectSettings } from './application/GetProjectSettings.js';
import { UpdateProjectSettings } from './application/UpdateProjectSettings.js';
import { ExportProjectUseCase } from './application/ExportProjectUseCase.js';
import { ImportProjectUseCase } from './application/ImportProjectUseCase.js';
import { AdminProjectRepoPrisma } from './infra/AdminProjectRepoPrisma.js';
import type { AdminProjectRepo } from './domain/Project/AdminProjectPorts.js';
import { ListAdminProjectsUseCase } from './application/ListAdminProjectsUseCase.js';
import { GetAdminProjectDetailUseCase } from './application/GetAdminProjectDetailUseCase.js';
import { GetAdminProjectStatsUseCase } from './application/GetAdminProjectStatsUseCase.js';
import type { FileRepo } from '../project-files/domain/ProjectFile/Ports.js';
import type { MaterializeTemplate } from './domain/MaterializeTemplate.js';
import type { BlobStorage } from '../../shared/storage/BlobStorage.js';
import type { ProjectAccessPolicy } from './domain/access/ProjectAccessPolicies.js';

/**
 * Projects Module Container
 * 
 * Provides centralized dependency injection for the projects module.
 */
export class ProjectsContainer {
  // Repository (typed as interface for DIP compliance)
  private projectRepo: ProjectRepo;
  private settingsRepo: ProjectSettingsRepository;

  // Use Cases
  public createProjectUseCase: CreateProjectUseCase;
  public getProjectUseCase: GetProjectUseCase;
  public listProjectsUseCase: ListProjectsUseCase;
  public updateProjectUseCase: UpdateProjectUseCase;
  public deleteProjectUseCase: DeleteProjectUseCase;
  public getProjectSettings: GetProjectSettings;
  public updateProjectSettings: UpdateProjectSettings;
  /** Wired by {@link wireZipPortability} after app-level dependencies are ready. */
  public exportProjectUseCase: ExportProjectUseCase | null = null;
  /** Wired by {@link wireZipPortability}. */
  public importProjectUseCase: ImportProjectUseCase | null = null;

  // Admin oversight (read-only across all owners)
  public listAdminProjectsUseCase: ListAdminProjectsUseCase;
  public getAdminProjectDetailUseCase: GetAdminProjectDetailUseCase;
  public getAdminProjectStatsUseCase: GetAdminProjectStatsUseCase;
  /** Admin .zip export (bypasses owner/member policy). Wired in {@link wireZipPortability}. */
  public adminExportProjectUseCase: ExportProjectUseCase | null = null;
  private readonly adminProjectRepo: AdminProjectRepo;

  /** Keep around to construct zip use cases on demand. */
  private readonly fileRepo: FileRepo;

  constructor(
    prisma: PrismaClient,
    fileRepo: FileRepo,
    materializeTemplate?: MaterializeTemplate,
  ) {
    this.fileRepo = fileRepo;
    // Initialize repositories
    this.projectRepo = new ProjectRepoPrisma(prisma);
    this.settingsRepo = new PrismaProjectSettingsRepository(prisma);

    // Wire use cases
    this.createProjectUseCase = new CreateProjectUseCase(
      this.projectRepo,
      fileRepo,
      this.settingsRepo,
      materializeTemplate,
    );
    this.getProjectUseCase = new GetProjectUseCase(this.projectRepo);
    this.listProjectsUseCase = new ListProjectsUseCase(this.projectRepo);
    this.updateProjectUseCase = new UpdateProjectUseCase(this.projectRepo);
    this.deleteProjectUseCase = new DeleteProjectUseCase(this.projectRepo);
    this.getProjectSettings = new GetProjectSettings(this.settingsRepo, this.projectRepo);
    this.updateProjectSettings = new UpdateProjectSettings(
      this.settingsRepo,
      this.projectRepo,
      fileRepo,
    );

    // Admin oversight use cases (read-only; auth enforced at route via requireAdmin)
    this.adminProjectRepo = new AdminProjectRepoPrisma(prisma);
    this.listAdminProjectsUseCase = new ListAdminProjectsUseCase(this.adminProjectRepo);
    this.getAdminProjectDetailUseCase = new GetAdminProjectDetailUseCase(this.adminProjectRepo);
    this.getAdminProjectStatsUseCase = new GetAdminProjectStatsUseCase(this.adminProjectRepo);
  }

  /**
   * Get the project repository instance
   * Useful for cross-module dependencies (e.g., project-files module)
   */
  getProjectRepo(): ProjectRepo {
    return this.projectRepo;
  }

  /**
   * Get the project-settings repository instance.
   * Used for cross-module composition (e.g. reading `mainPath` when publishing
   * a template version from a source project).
   */
  getSettingsRepo(): ProjectSettingsRepository {
    return this.settingsRepo;
  }

  /**
   * Wire export/import (zip portability) use cases once the BlobStorage and
   * ProjectAccessPolicy are available. Follows the same lazy-wiring pattern
   * as `ProjectFilesContainer.wireBinaryUpload`.
   */
  wireZipPortability(
    blobStorage: BlobStorage,
    projectAccess: ProjectAccessPolicy,
  ): void {
    this.exportProjectUseCase = new ExportProjectUseCase(
      this.projectRepo,
      this.fileRepo,
      projectAccess,
      blobStorage,
    );
    this.importProjectUseCase = new ImportProjectUseCase(
      this.projectRepo,
      this.fileRepo,
      blobStorage,
      this.settingsRepo,
    );

    // Admin export reuses ExportProjectUseCase with an allow-all access policy
    // — the route is already guarded by requireAdmin, and a missing project
    // still resolves to PROJECT_NOT_FOUND inside the use case.
    const adminBypassAccess: ProjectAccessPolicy = {
      async requireProjectAccess(): Promise<void> {
        /* admin already authorized at route level */
      },
    };
    this.adminExportProjectUseCase = new ExportProjectUseCase(
      this.projectRepo,
      this.fileRepo,
      adminBypassAccess,
      blobStorage,
    );
  }
}
