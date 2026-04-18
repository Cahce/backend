/**
 * Get Files For Compilation Use Case
 * 
 * Application layer orchestration for retrieving files needed for compilation.
 */

import type { FileRepo } from '../domain/ProjectFile/Ports.js';
import type { ProjectRepo } from '../../projects/domain/Project/Ports.js';
import type { File } from '../domain/ProjectFile/Types.js';
import { FileErrors } from '../domain/ProjectFile/Errors.js';
import { ProjectAuthPolicy, type AuthContext } from '../../projects/domain/Project/Policies.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';

/**
 * Command for getting files for compilation
 */
export interface GetFilesForCompilationCommand {
  projectId: string;
  userId: string;
  userRole: 'admin' | 'teacher' | 'student';
}

/**
 * Get Files For Compilation Use Case
 * 
 * Retrieves all files needed for Typst compilation (typst, bib, image, data).
 */
export class GetFilesForCompilationUseCase {
  constructor(
    private readonly FileRepo: FileRepo,
    private readonly ProjectRepo: ProjectRepo,
  ) {}

  async execute(command: GetFilesForCompilationCommand): Promise<Result<File[]>> {
    try {
      // Verify project exists
      const project = await this.ProjectRepo.findById(command.projectId);

      if (!project) {
        return failure(FileErrors.PROJECT_NOT_FOUND.code, FileErrors.PROJECT_NOT_FOUND.message);
      }

      // Enforce authorization
      const authContext: AuthContext = {
        userId: command.userId,
        role: command.userRole,
      };

      if (!ProjectAuthPolicy.canRead(project, authContext)) {
        return failure(FileErrors.UNAUTHORIZED.code, FileErrors.UNAUTHORIZED.message);
      }

      // Find files for compilation
      const files = await this.FileRepo.findForCompilation(command.projectId);

      return success(files);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi lấy tệp để biên dịch');
    }
  }
}
