
import type { PrismaClient } from '../../../generated/prisma/index.js';
import { Prisma } from '../../../generated/prisma/index.js';
import type { ProjectRepo } from '../domain/Project/Ports.js';
import type { Project, CreateProjectData, UpdateProjectData } from '../domain/Project/Types.js';
import { TemplateCategory } from '../domain/Project/Types.js';

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
      const project = await this.prisma.project.update({
        where: { id: data.projectId },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.category !== undefined && { category: data.category }),
        },
      });

      return this.mapToProject(project);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('PROJECT_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  async delete(projectId: string): Promise<void> {
    try {
      await this.prisma.project.delete({
        where: { id: projectId },
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

  async getEffectiveAccess(
    projectId: string,
    userId: string,
  ): Promise<{ membershipRole: 'editor' | 'viewer' | null; isAdvisor: boolean }> {
    const [member, advisor] = await Promise.all([
      this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
        select: { role: true },
      }),
      this.prisma.projectAdvisor.findFirst({
        where: { projectId, teacher: { accountId: userId } },
        select: { id: true },
      }),
    ]);

    const membershipRole: 'editor' | 'viewer' | null =
      member?.role === 'editor' || member?.role === 'viewer' ? member.role : null;

    return { membershipRole, isAdvisor: advisor !== null };
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
  }): Project {
    return {
      id: prismaProject.id,
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
