
import * as crypto from 'node:crypto';
import type { FileRepo } from '../domain/ProjectFile/Ports.js';
import type { ProjectRepo } from '../../projects/domain/Project/Ports.js';
import type { File } from '../domain/ProjectFile/Types.js';
import { FileErrors } from '../domain/ProjectFile/Errors.js';
import { ProjectAuthPolicy, type AuthContext } from '../../projects/domain/Project/Policies.js';
import { buildProjectAuthContext } from '../../projects/application/ProjectAuthContext.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';

export interface UpdateFileCommand {
  projectId: string;
  path: string;
  content: string;
  userId: string;
  userRole: 'admin' | 'teacher' | 'student';
}

export class UpdateFileUseCase {
  constructor(
    private readonly fileRepo: FileRepo,
    private readonly projectRepo: ProjectRepo,
  ) {}

  async execute(command: UpdateFileCommand): Promise<Result<File>> {
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

      const sizeBytes = Buffer.byteLength(command.content, 'utf8');
      const sha256 = crypto.createHash('sha256').update(command.content, 'utf8').digest('hex');

      const file = await this.fileRepo.update({
        projectId: command.projectId,
        path: command.path,
        content: command.content,
        sizeBytes,
        sha256,
      });

      return success(file);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi cập nhật tệp');
    }
  }
}
