/**
 * Project Files Module Container
 * 
 * Centralized dependency wiring for the project-files module.
 * Instantiates repositories and use cases with proper dependencies.
 */

import type { PrismaClient } from '../../generated/prisma/index.js';
import type { ProjectRepo } from '../projects/domain/Project/Ports.js';
import type { FileRepo } from './domain/ProjectFile/Ports.js';
import { FileRepoPrisma } from './infra/FileRepoPrisma.js';
import { ListFilesUseCase } from './application/ListFilesUseCase.js';
import { GetFileUseCase } from './application/GetFileUseCase.js';
import { CreateFileUseCase } from './application/CreateFileUseCase.js';
import { UpdateFileUseCase } from './application/UpdateFileUseCase.js';
import { RenameFileUseCase } from './application/RenameFileUseCase.js';
import { DeleteFileUseCase } from './application/DeleteFileUseCase.js';
import { GetFilesForCompilationUseCase } from './application/GetFilesForCompilationUseCase.js';
import { CreateFilesFromTemplateUseCase } from './application/CreateFilesFromTemplateUseCase.js';

/**
 * Project Files Module Container
 * 
 * Provides centralized dependency injection for the project-files module.
 */
export class ProjectFilesContainer {
  // Repository (typed as interface for DIP compliance)
  private fileRepo: FileRepo;

  // Use Cases
  public listFilesUseCase: ListFilesUseCase;
  public getFileUseCase: GetFileUseCase;
  public createFileUseCase: CreateFileUseCase;
  public updateFileUseCase: UpdateFileUseCase;
  public renameFileUseCase: RenameFileUseCase;
  public deleteFileUseCase: DeleteFileUseCase;
  public getFilesForCompilationUseCase: GetFilesForCompilationUseCase;
  public createFilesFromTemplateUseCase: CreateFilesFromTemplateUseCase;

  constructor(prisma: PrismaClient, projectRepo: ProjectRepo) {
    // Initialize repository
    this.fileRepo = new FileRepoPrisma(prisma);

    // Wire use cases
    this.listFilesUseCase = new ListFilesUseCase(this.fileRepo, projectRepo);
    this.getFileUseCase = new GetFileUseCase(this.fileRepo, projectRepo);
    this.createFileUseCase = new CreateFileUseCase(this.fileRepo, projectRepo);
    this.updateFileUseCase = new UpdateFileUseCase(this.fileRepo, projectRepo);
    this.renameFileUseCase = new RenameFileUseCase(this.fileRepo, projectRepo);
    this.deleteFileUseCase = new DeleteFileUseCase(this.fileRepo, projectRepo);
    this.getFilesForCompilationUseCase = new GetFilesForCompilationUseCase(
      this.fileRepo,
      projectRepo,
    );
    this.createFilesFromTemplateUseCase = new CreateFilesFromTemplateUseCase(this.fileRepo);
  }

  /**
   * Get the file repository instance
   * Useful for cross-module dependencies
   */
  getFileRepo(): FileRepo {
    return this.fileRepo;
  }
}
