
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
import { DuplicateProjectUseCase } from './application/DuplicateProjectUseCase.js';
import { AdminProjectRepoPrisma } from './infra/AdminProjectRepoPrisma.js';
import type { AdminProjectRepo } from './domain/Project/AdminProjectPorts.js';
import { ListAdminProjectsUseCase } from './application/ListAdminProjectsUseCase.js';
import { GetAdminProjectDetailUseCase } from './application/GetAdminProjectDetailUseCase.js';
import { GetAdminProjectStatsUseCase } from './application/GetAdminProjectStatsUseCase.js';
import type { FileRepo } from '../project-files/domain/ProjectFile/Ports.js';
import type { MaterializeTemplate } from './domain/MaterializeTemplate.js';
import type { BlobStorage } from '../../shared/storage/BlobStorage.js';
import type { ProjectAccessPolicy } from './domain/access/ProjectAccessPolicies.js';

export class ProjectsContainer {
  private projectRepo: ProjectRepo;
  private settingsRepo: ProjectSettingsRepository;

  public createProjectUseCase: CreateProjectUseCase;
  public getProjectUseCase: GetProjectUseCase;
  public listProjectsUseCase: ListProjectsUseCase;
  public updateProjectUseCase: UpdateProjectUseCase;
  public deleteProjectUseCase: DeleteProjectUseCase;
  public getProjectSettings: GetProjectSettings;
  public updateProjectSettings: UpdateProjectSettings;
  public exportProjectUseCase: ExportProjectUseCase | null = null;
  public importProjectUseCase: ImportProjectUseCase | null = null;
  public duplicateProjectUseCase: DuplicateProjectUseCase | null = null;

  public listAdminProjectsUseCase: ListAdminProjectsUseCase;
  public getAdminProjectDetailUseCase: GetAdminProjectDetailUseCase;
  public getAdminProjectStatsUseCase: GetAdminProjectStatsUseCase;
  public adminExportProjectUseCase: ExportProjectUseCase | null = null;
  private readonly adminProjectRepo: AdminProjectRepo;

  private readonly fileRepo: FileRepo;

  constructor(
    prisma: PrismaClient,
    fileRepo: FileRepo,
    materializeTemplate?: MaterializeTemplate,
    blobStorage?: BlobStorage,
  ) {
    this.fileRepo = fileRepo;
    this.projectRepo = new ProjectRepoPrisma(prisma);
    this.settingsRepo = new PrismaProjectSettingsRepository(prisma);

    this.createProjectUseCase = new CreateProjectUseCase(
      this.projectRepo,
      fileRepo,
      this.settingsRepo,
      materializeTemplate,
      blobStorage,
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

    this.adminProjectRepo = new AdminProjectRepoPrisma(prisma);
    this.listAdminProjectsUseCase = new ListAdminProjectsUseCase(this.adminProjectRepo);
    this.getAdminProjectDetailUseCase = new GetAdminProjectDetailUseCase(this.adminProjectRepo);
    this.getAdminProjectStatsUseCase = new GetAdminProjectStatsUseCase(this.adminProjectRepo);
  }

  getProjectRepo(): ProjectRepo {
    return this.projectRepo;
  }

  getSettingsRepo(): ProjectSettingsRepository {
    return this.settingsRepo;
  }

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
    this.duplicateProjectUseCase = new DuplicateProjectUseCase(
      this.projectRepo,
      this.fileRepo,
      projectAccess,
      blobStorage,
      this.settingsRepo,
    );

    const adminBypassAccess: ProjectAccessPolicy = {
      async requireProjectAccess(): Promise<void> {
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
