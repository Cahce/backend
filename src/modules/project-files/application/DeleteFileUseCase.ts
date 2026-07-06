
import type { FileRepo } from '../domain/ProjectFile/Ports.js';
import type { ProjectRepo } from '../../projects/domain/Project/Ports.js';
import { FileErrors } from '../domain/ProjectFile/Errors.js';
import { ProjectAuthPolicy, type AuthContext } from '../../projects/domain/Project/Policies.js';
import { buildProjectAuthContext } from '../../projects/application/ProjectAuthContext.js';
import type { BlobStorage } from '../../../shared/storage/BlobStorage.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';

export interface DeleteFileCommand {
  projectId: string;
  path: string;
  userId: string;
  userRole: 'admin' | 'teacher' | 'student';
}

export class DeleteFileUseCase {
  constructor(
    private readonly fileRepo: FileRepo,
    private readonly projectRepo: ProjectRepo,
    private readonly blobStorage?: BlobStorage,
  ) {}

  async execute(command: DeleteFileCommand): Promise<Result<void>> {
    try {
      const project = await this.projectRepo.findById(command.projectId);

      if (!project) {
        return failure(FileErrors.PROJECT_NOT_FOUND.code, FileErrors.PROJECT_NOT_FOUND.message);
      }

      const authContext: AuthContext = await buildProjectAuthContext(
        this.projectRepo,
        project,
        command.userId,
        command.userRole,
      );

      if (!ProjectAuthPolicy.canWrite(project, authContext)) {
        return failure(FileErrors.UNAUTHORIZED.code, FileErrors.UNAUTHORIZED.message);
      }

      const existingFile = await this.fileRepo.findByProjectIdAndPath(
        command.projectId,
        command.path,
      );

      if (!existingFile) {
        return failure(FileErrors.FILE_NOT_FOUND.code, FileErrors.FILE_NOT_FOUND.message);
      }

      await this.fileRepo.delete(command.projectId, command.path);

      if (existingFile.storageKey && this.blobStorage) {
        try {
          await this.blobStorage.delete(existingFile.storageKey);
        } catch {
        }
      }

      return success(undefined);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi xóa tệp');
    }
  }
}
