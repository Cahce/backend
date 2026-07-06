
import type { FileRepo } from '../domain/ProjectFile/Ports.js';
import type { ProjectRepo } from '../../projects/domain/Project/Ports.js';
import type { FileMetadata } from '../domain/ProjectFile/Types.js';
import { FileErrors } from '../domain/ProjectFile/Errors.js';
import { ProjectAuthPolicy, type AuthContext } from '../../projects/domain/Project/Policies.js';
import { buildProjectAuthContext } from '../../projects/application/ProjectAuthContext.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';

export interface ListFilesCommand {
  projectId: string;
  userId: string;
  userRole: 'admin' | 'teacher' | 'student';
}

export class ListFilesUseCase {
  constructor(
    private readonly fileRepo: FileRepo,
    private readonly projectRepo: ProjectRepo,
  ) {}

  async execute(command: ListFilesCommand): Promise<Result<FileMetadata[]>> {
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

      if (!ProjectAuthPolicy.canRead(project, authContext)) {
        return failure(FileErrors.UNAUTHORIZED.code, FileErrors.UNAUTHORIZED.message);
      }

      const metadata = await this.fileRepo.listMetadataByProjectId(command.projectId);

      return success(metadata);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi lấy danh sách tệp');
    }
  }
}
