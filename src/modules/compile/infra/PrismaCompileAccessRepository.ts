import type { PrismaClient } from '../../../generated/prisma/index.js';
import type { ProjectAccessPolicy } from '../../projects/domain/access/ProjectAccessPolicies.js';
import type { OfficialCompileAccessPolicy } from '../domain/Policies.js';
import { accessFor } from '../../projects/infra/CollaborationTransaction.js';
import { CompileJobError } from '../domain/Errors.js';
import { CollaborationError } from '../../projects/domain/access/CollaborationErrors.js';

export class PrismaCompileAccessRepository implements ProjectAccessPolicy, OfficialCompileAccessPolicy {
  constructor(private readonly prisma: PrismaClient) {}
  private async access(projectId: string, userId: string, role: 'student' | 'teacher' | 'admin') {
    try { return await accessFor(this.prisma, projectId, { userId, role }); }
    catch (error) { if (error instanceof CollaborationError) throw new CompileJobError(error.code, error.message); throw error; }
  }
  async requireProjectAccess(projectId: string, userId: string): Promise<void> {
    const access = await this.access(projectId, userId, 'student');
    if (!access.canRead) throw new CompileJobError('PROJECT_ACCESS_DENIED', 'Bạn không có quyền truy cập dự án này');
  }
  async requireOfficialCompileAccess(projectId: string, userId: string, userRole: 'admin' | 'teacher' | 'student'): Promise<void> {
    const access = await this.access(projectId, userId, userRole);
    if (!access.canCompileOfficial) throw new CompileJobError('PROJECT_ACCESS_DENIED', 'Bạn không có quyền biên dịch/xuất bản dự án này');
  }
}
