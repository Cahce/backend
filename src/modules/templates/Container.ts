/**
 * Templates Module Container
 * 
 * Centralized dependency wiring for the templates module.
 * Instantiates repositories, storage, and use cases with proper dependencies.
 */

import type { PrismaClient } from '../../generated/prisma/index.js';
import type { TemplateRepo, TemplateStorageGateway, SourceProjectGateway } from './domain/Ports.js';
import type { MaterializedFile } from './domain/Types.js';
import { InvalidTemplateVersionError } from './domain/Errors.js';
import { TemplateRepoPrisma } from './infra/TemplateRepoPrisma.js';
import { TemplateStorageFs } from './infra/TemplateStorageFs.js';
import { CachedTemplateStorageGateway } from './infra/CachedTemplateStorageGateway.js';
import { CreateTemplateUseCase } from './application/CreateTemplateUseCase.js';
import { ListTemplatesUseCase } from './application/ListTemplatesUseCase.js';
import { GetTemplateByIdUseCase } from './application/GetTemplateByIdUseCase.js';
import { UpdateTemplateUseCase } from './application/UpdateTemplateUseCase.js';
import { DeleteTemplateUseCase } from './application/DeleteTemplateUseCase.js';
import { ListPublicTemplatesUseCase } from './application/ListPublicTemplatesUseCase.js';
import { CreateTemplateVersionUseCase } from './application/CreateTemplateVersionUseCase.js';
import { ListVersionsByTemplateUseCase } from './application/ListVersionsByTemplateUseCase.js';
import { UpdateTemplateVersionUseCase } from './application/UpdateTemplateVersionUseCase.js';
import { GetTemplateVersionFileUseCase } from './application/GetTemplateVersionFileUseCase.js';
import { MaterializeTemplateVersionUseCase } from './application/MaterializeTemplateVersionUseCase.js';
import { CreateTemplateSourceProjectUseCase } from './application/CreateTemplateSourceProjectUseCase.js';
import { ImportTemplateSourceProjectUseCase } from './application/ImportTemplateSourceProjectUseCase.js';
import { PublishTemplateVersionFromSourceUseCase } from './application/PublishTemplateVersionFromSourceUseCase.js';

/**
 * Templates Module Container
 * 
 * Provides centralized dependency injection for the templates module.
 */
export class TemplatesContainer {
  // Repositories and gateways
  private templateRepo: TemplateRepo;
  private storage: TemplateStorageGateway;

  // Use Cases
  public createTemplate: CreateTemplateUseCase;
  public listTemplates: ListTemplatesUseCase;
  public getTemplateById: GetTemplateByIdUseCase;
  public updateTemplate: UpdateTemplateUseCase;
  public deleteTemplate: DeleteTemplateUseCase;
  public listPublicTemplates: ListPublicTemplatesUseCase;
  public createTemplateVersion: CreateTemplateVersionUseCase;
  public listVersionsByTemplate: ListVersionsByTemplateUseCase;
  public updateTemplateVersion: UpdateTemplateVersionUseCase;
  public getTemplateVersionFile: GetTemplateVersionFileUseCase;
  public materializeTemplateVersion: MaterializeTemplateVersionUseCase;
  /** Source-project authoring use cases — wired by {@link wireSourceProjectAuthoring}. */
  public createTemplateSourceProject: CreateTemplateSourceProjectUseCase | null = null;
  public importTemplateSourceProject: ImportTemplateSourceProjectUseCase | null = null;
  public publishTemplateVersionFromSource: PublishTemplateVersionFromSourceUseCase | null = null;

  constructor(deps: { prisma: PrismaClient; templateStorageDir: string }) {
    // Initialize repositories and gateways.
    // Storage is wrapped with an LRU cache so that hot `readFiles()` calls
    // (every project create-from-template) skip filesystem I/O on repeat.
    // Cache is bounded by both entry count and total bytes (xem
    // `CachedTemplateStorageGateway` defaults).
    this.templateRepo = new TemplateRepoPrisma(deps.prisma);
    this.storage = new CachedTemplateStorageGateway(
      new TemplateStorageFs(deps.templateStorageDir),
    );

    // Wire use cases
    this.createTemplate = new CreateTemplateUseCase(this.templateRepo);
    this.listTemplates = new ListTemplatesUseCase(this.templateRepo);
    this.getTemplateById = new GetTemplateByIdUseCase(this.templateRepo);
    this.updateTemplate = new UpdateTemplateUseCase(this.templateRepo);
    this.deleteTemplate = new DeleteTemplateUseCase(this.templateRepo);
    this.listPublicTemplates = new ListPublicTemplatesUseCase(this.templateRepo);
    this.createTemplateVersion = new CreateTemplateVersionUseCase(this.templateRepo, this.storage);
    this.listVersionsByTemplate = new ListVersionsByTemplateUseCase(this.templateRepo);
    this.updateTemplateVersion = new UpdateTemplateVersionUseCase(this.templateRepo);
    this.getTemplateVersionFile = new GetTemplateVersionFileUseCase(
      this.templateRepo,
      this.storage,
    );
    this.materializeTemplateVersion = new MaterializeTemplateVersionUseCase(
      this.templateRepo,
      this.storage,
    );
  }

  /**
   * Wire the source-project authoring use cases (create/import source project,
   * publish version from source). Deferred — like
   * `ProjectsContainer.wireZipPortability` — because the gateway is composed
   * from the projects + project-files containers, which are built after this
   * container in `app.ts`.
   */
  wireSourceProjectAuthoring(gateway: SourceProjectGateway): void {
    this.createTemplateSourceProject = new CreateTemplateSourceProjectUseCase(
      this.templateRepo,
      gateway,
    );
    this.importTemplateSourceProject = new ImportTemplateSourceProjectUseCase(
      this.templateRepo,
      gateway,
    );
    this.publishTemplateVersionFromSource =
      new PublishTemplateVersionFromSourceUseCase(
        this.templateRepo,
        this.storage,
        gateway,
      );
  }

  /**
   * Get materialize function for cross-module use
   * 
   * This is used by projects module to materialize template versions.
   * Returns an object containing the materialized files and the entry path from the template version.
   * 
   * NOTE: This returns the new shape { files, entryPath }, but the MaterializeTemplate interface
   * in projects/domain still has the old signature. This will be fixed in T1.4 when CreateProjectUseCase
   * is updated to handle the new shape.
   * 
   * @returns Function that takes versionId and returns { files, entryPath }
   * @throws InvalidTemplateVersionError if version is invalid or inactive
   * @throws Error for other errors
   */
  getMaterializeFunction(): (versionId: string) => Promise<{ files: MaterializedFile[]; entryPath: string }> {
    return async (versionId: string) => {
      const result = await this.materializeTemplateVersion.execute(versionId);
      
      if (!result.success) {
        // Throw custom error class for invalid template version
        if (result.error.code === 'INVALID_TEMPLATE_VERSION') {
          throw new InvalidTemplateVersionError(result.error.message);
        }
        
        // For other errors, throw generic Error with message
        throw new Error(result.error.message);
      }
      
      // Return both files and entryPath from template version
      return result.data;
    };
  }
}

/**
 * Factory function to create templates container
 */
export function createTemplatesContainer(deps: {
  prisma: PrismaClient;
  templateStorageDir: string;
}): TemplatesContainer {
  return new TemplatesContainer(deps);
}
