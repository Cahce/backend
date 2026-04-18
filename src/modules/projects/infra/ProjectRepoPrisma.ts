/**
 * Prisma implementation of Project repository
 * 
 * Infrastructure layer implementation of ProjectRepo port.
 * Handles all Project data access operations using Prisma.
 */

import type { PrismaClient } from '../../../generated/prisma/index.js';
import { Prisma } from '../../../generated/prisma/index.js';
import type { ProjectRepo } from '../domain/Project/Ports.js';
import type { Project, CreateProjectData, UpdateProjectData } from '../domain/Project/Types.js';
import { TemplateCategory } from '../domain/Project/Types.js';

/**
 * Prisma-based Project repository implementation
 */
export class ProjectRepoPrisma implements ProjectRepo {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new Project
   */
  async create(data: CreateProjectData): Promise<Project> {
    try {
      const project = await this.prisma.project.create({
        data: {
          title: data.title,
          category: data.category,
          ownerId: data.ownerId,
        },
      });

      return this.mapToProject(project);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find Project by ID
   */
  async findById(id: string): Promise<Project | null> {
    const project = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return null;
    }

    return this.mapToProject(project);
  }

  /**
   * Find all Projects owned by a user
   * Results are ordered by updatedAt descending (most recently updated first)
   */
  async listByOwnerId(ownerId: string): Promise<Project[]> {
    const projects = await this.prisma.project.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
    });

    return projects.map((project) => this.mapToProject(project));
  }

  /**
   * Update an existing Project
   */
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
          // Record not found
          throw new Error('PROJECT_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  /**
   * Delete a Project
   * Database cascade will handle File record removal
   */
  async delete(projectId: string): Promise<void> {
    try {
      await this.prisma.project.delete({
        where: { id: projectId },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          // Record not found
          throw new Error('PROJECT_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  /**
   * Map Prisma Project model to domain Project type
   */
  private mapToProject(prismaProject: {
    id: string;
    title: string;
    category: string;
    ownerId: string | null;
    createdAt: Date;
    updatedAt: Date;
    lastEditedAt: Date | null;
  }): Project {
    return {
      id: prismaProject.id,
      title: prismaProject.title,
      category: prismaProject.category as TemplateCategory,
      ownerId: prismaProject.ownerId,
      createdAt: prismaProject.createdAt,
      updatedAt: prismaProject.updatedAt,
      lastEditedAt: prismaProject.lastEditedAt,
    };
  }
}
