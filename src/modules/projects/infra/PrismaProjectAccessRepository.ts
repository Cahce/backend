import type { PrismaClient } from '../../../generated/prisma/index.js';
import type { ProjectAccessPolicy, ProjectWriteAccessPolicy } from '../domain/access/ProjectAccessPolicies.js';
import { accessFor } from './CollaborationTransaction.js';
import { requireCondition } from '../domain/access/CollaborationErrors.js';

export class PrismaProjectAccessRepository implements ProjectAccessPolicy, ProjectWriteAccessPolicy {
  constructor(private readonly prisma: PrismaClient) {}
  async requireProjectAccess(projectId: string, userId: string): Promise<void> {
    const access = await accessFor(this.prisma, projectId, { userId, role: 'student' });
    requireCondition(access.canRead, 'PROJECT_ACCESS_DENIED', 'Bạn không có quyền truy cập dự án này');
  }
  async requireWriteAccess(projectId: string, userId: string): Promise<void> {
    const access = await accessFor(this.prisma, projectId, { userId, role: 'student' });
    requireCondition(access.canEdit, 'PROJECT_ACCESS_DENIED', 'Bạn không có quyền chỉnh sửa dự án này');
  }
  async requireExportAccess(projectId: string, userId: string): Promise<void> {
    const access = await accessFor(this.prisma, projectId, { userId, role: 'student' });
    requireCondition(access.canExportProject, 'PROJECT_ACCESS_DENIED', 'Bạn không có quyền xuất dự án này');
  }
}
