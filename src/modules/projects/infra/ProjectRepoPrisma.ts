
import type { PrismaClient } from '../../../generated/prisma/index.js';
import { Prisma } from '../../../generated/prisma/index.js';
import type { ProjectRepo } from '../domain/Project/Ports.js';
import type { Project, CreateProjectData, UpdateProjectData } from '../domain/Project/Types.js';
import { TemplateCategory } from '../domain/Project/Types.js';
import { accessFor, appendProjectEvent, loadAccessFacts, lockProject } from './CollaborationTransaction.js';
import { CollaborationError, requireCondition } from '../domain/access/CollaborationErrors.js';

export class ProjectRepoPrisma implements ProjectRepo {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateProjectData): Promise<Project> {
    try {
      const project = await this.prisma.project.create({
        data: {
          title: data.title,
          category: data.category,
          ownerId: data.ownerId,
          templateId: data.templateId || null,
          templateVersionId: data.templateVersionId || null,
          collaborationState: { create: {} },
        },
      });

      return this.mapToProject(project);
    } catch (error) {
      throw error;
    }
  }

  async findById(id: string): Promise<Project | null> {
    const project = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return null;
    }

    return this.mapToProject(project);
  }

  async listByOwnerId(ownerId: string): Promise<Project[]> {
    const projects = await this.prisma.project.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
    });

    return projects.map((project) => this.mapToProject(project));
  }

  async update(data: UpdateProjectData): Promise<Project> {
    try {
      const project = await this.prisma.$transaction(async tx => {
        await lockProject(tx, data.projectId);
        if (data.actorId) {
          const access = await accessFor(tx, data.projectId, { userId: data.actorId, role: 'student' });
          requireCondition(access.canEdit, 'PROJECT_ACCESS_DENIED', 'Bạn không có quyền chỉnh sửa dự án này');
        }
        const updated = await tx.project.update({
        where: { id: data.projectId, ...(data.baseRevision ? { metadataRevision: data.baseRevision } : {}) },
        data: {
          metadataRevision: { increment: 1 },
          ...(data.title !== undefined && { title: data.title }),
          ...(data.category !== undefined && { category: data.category }),
        },
        });
        await appendProjectEvent(tx, data.projectId, 'project.metadata.updated', data.projectId, data.actorId ?? null);
        return updated;
      });

      return this.mapToProject(project);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new CollaborationError('PROJECT_VERSION_CONFLICT', 'Thông tin dự án đã thay đổi. Hãy tải lại', 409);
        }
      }
      throw error;
    }
  }

  async delete(projectId: string, actorId?: string): Promise<void> {
    try {
      await this.prisma.$transaction(async tx => {
        await lockProject(tx, projectId);
        if (actorId) requireCondition((await accessFor(tx, projectId, { userId: actorId, role: 'student' })).canDelete,
          'PROJECT_ACCESS_DENIED', 'Chỉ chủ dự án được xóa dự án');
        await tx.projectCommentThread.updateMany({ where: { projectId }, data: { fileId: null } });
        await tx.project.delete({ where: { id: projectId } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('PROJECT_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  async listStorageKeys(projectId: string): Promise<string[]> {
    const [files, artifacts] = await Promise.all([
      this.prisma.file.findMany({
        where: { projectId, storageKey: { not: null } },
        select: { storageKey: true },
      }),
      this.prisma.compileArtifact.findMany({
        where: { projectId },
        select: { storageKey: true },
      }),
    ]);

    const keys: string[] = [];
    for (const file of files) {
      if (file.storageKey) {
        keys.push(file.storageKey);
      }
    }
    for (const artifact of artifacts) {
      keys.push(artifact.storageKey);
    }

    return keys;
  }

  async getEffectiveAccess(
    projectId: string,
    userId: string,
  ) {
    return loadAccessFacts(this.prisma, projectId, userId);
  }

  private mapToProject(prismaProject: {
    id: string;
    title: string;
    category: string;
    ownerId: string | null;
    templateId?: string | null;
    templateVersionId?: string | null;
    createdAt: Date;
    updatedAt: Date;
    lastEditedAt: Date | null;
    metadataRevision?: number;
  }): Project {
    return {
      id: prismaProject.id,
      metadataRevision: prismaProject.metadataRevision ?? 1,
      title: prismaProject.title,
      category: prismaProject.category as TemplateCategory,
      ownerId: prismaProject.ownerId,
      templateId: prismaProject.templateId || null,
      templateVersionId: prismaProject.templateVersionId || null,
      createdAt: prismaProject.createdAt,
      updatedAt: prismaProject.updatedAt,
      lastEditedAt: prismaProject.lastEditedAt,
    };
  }
}
