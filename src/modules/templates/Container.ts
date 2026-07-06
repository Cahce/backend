
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

export class TemplatesContainer {
  private templateRepo: TemplateRepo;
  private storage: TemplateStorageGateway;

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
  public createTemplateSourceProject: CreateTemplateSourceProjectUseCase | null = null;
  public importTemplateSourceProject: ImportTemplateSourceProjectUseCase | null = null;
  public publishTemplateVersionFromSource: PublishTemplateVersionFromSourceUseCase | null = null;

  constructor(deps: { prisma: PrismaClient; templateStorageDir: string }) {
    this.templateRepo = new TemplateRepoPrisma(deps.prisma);
    this.storage = new CachedTemplateStorageGateway(
      new TemplateStorageFs(deps.templateStorageDir),
    );

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

  getMaterializeFunction(): (versionId: string) => Promise<{ files: MaterializedFile[]; entryPath: string }> {
    return async (versionId: string) => {
      const result = await this.materializeTemplateVersion.execute(versionId);
      
      if (!result.success) {
        if (result.error.code === 'INVALID_TEMPLATE_VERSION') {
          throw new InvalidTemplateVersionError(result.error.message);
        }
        
        throw new Error(result.error.message);
      }
      
      return result.data;
    };
  }
}

export function createTemplatesContainer(deps: {
  prisma: PrismaClient;
  templateStorageDir: string;
}): TemplatesContainer {
  return new TemplatesContainer(deps);
}
