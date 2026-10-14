import type { ProjectRepo } from '../domain/Project/Ports.js';
import { ProjectErrors } from '../domain/Project/Errors.js';
import { ProjectAuthPolicy, type AuthContext } from '../domain/Project/Policies.js';
import type { BlobStorage } from '../../../shared/storage/BlobStorage.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';
import { CollaborationError } from '../domain/access/CollaborationErrors.js';

export interface DeleteProjectCommand {
  projectId: string;
  userId: string;
  userRole: 'admin' | 'teacher' | 'student';
}

export class DeleteProjectUseCase {
  constructor(
    private readonly projectRepo: ProjectRepo,
    private readonly blobStorage?: BlobStorage,
  ) { }

  async execute(command: DeleteProjectCommand): Promise<Result<void>> {
    try {
      const project = await this.projectRepo.findById(command.projectId);

      if (!project) {
        return failure(ProjectErrors.PROJECT_NOT_FOUND.code, ProjectErrors.PROJECT_NOT_FOUND.message);
      }

      const authContext: AuthContext = {
        userId: command.userId,
        role: command.userRole,
      };

      if (!ProjectAuthPolicy.canDelete(project, authContext)) {
        return failure(ProjectErrors.UNAUTHORIZED.code, ProjectErrors.UNAUTHORIZED.message);
      }

      // Collect the physical blob keys BEFORE the delete: File/CompileArtifact
      // rows are removed by Prisma's onDelete: Cascade, so they can no longer be
      // queried afterwards.
      const storageKeys = this.blobStorage
        ? await this.projectRepo.listStorageKeys(command.projectId)
        : [];

      await this.projectRepo.delete(command.projectId, command.userId);

      // Free the orphaned blobs (uploaded files + compiled PDFs). Best-effort:
      // a missing/failed blob must not fail the already-committed DB delete.
      if (this.blobStorage) {
        for (const key of storageKeys) {
          try {
            await this.blobStorage.delete(key);
          } catch {
            // ignore — blob may already be gone; DB state is authoritative
          }
        }
      }

      return success(undefined);
    } catch (error) {
      if (error instanceof CollaborationError) return failure(error.code, error.message);
      return failure('INTERNAL_ERROR', 'Lỗi khi xóa dự án');
    }
  }
}
