
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
import { UploadBinaryFileUseCase } from './application/UploadBinaryFileUseCase.js';
import type { BlobStorage } from '../../shared/storage/BlobStorage.js';
import type { ProjectWriteAccessPolicy } from '../projects/domain/access/ProjectAccessPolicies.js';

export class ProjectFilesContainer {
  private fileRepo: FileRepo;

  public listFilesUseCase: ListFilesUseCase;
  public getFileUseCase: GetFileUseCase;
  public createFileUseCase: CreateFileUseCase;
  public updateFileUseCase: UpdateFileUseCase;
  public renameFileUseCase: RenameFileUseCase;
  public deleteFileUseCase: DeleteFileUseCase;
  public getFilesForCompilationUseCase: GetFilesForCompilationUseCase;
  public createFilesFromTemplateUseCase: CreateFilesFromTemplateUseCase;
  public uploadBinaryFileUseCase: UploadBinaryFileUseCase | null = null;

  constructor(prisma: PrismaClient, private readonly projectRepo: ProjectRepo) {
    this.fileRepo = new FileRepoPrisma(prisma);

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

  wireBinaryUpload(blobStorage: BlobStorage, projectAccess: ProjectWriteAccessPolicy): void {
    this.uploadBinaryFileUseCase = new UploadBinaryFileUseCase(
      this.fileRepo,
      blobStorage,
      projectAccess,
    );
    this.deleteFileUseCase = new DeleteFileUseCase(
      this.fileRepo,
      this.projectRepo,
      blobStorage,
    );
  }

  getFileRepo(): FileRepo {
    return this.fileRepo;
  }
}
