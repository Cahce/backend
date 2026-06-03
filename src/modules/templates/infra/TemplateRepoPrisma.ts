/**
 * Prisma implementation of Template repository
 * 
 * Infrastructure layer implementation of TemplateRepo port.
 * Handles all Template and TemplateVersion data access operations using Prisma.
 */

import type { PrismaClient } from '../../../generated/prisma/index.js';
import { Prisma } from '../../../generated/prisma/index.js';
import type { TemplateRepo } from '../domain/Ports.js';
import type {
  Template,
  TemplateVersion,
  TemplateWithLatestVersion,
  CreateTemplateData,
  UpdateTemplateData,
  TemplateFilter,
  CreateVersionData,
} from '../domain/Types.js';
import { TemplateCategory } from '../domain/Types.js';

/**
 * Prisma-based Template repository implementation
 */
export class TemplateRepoPrisma implements TemplateRepo {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new Template
   */
  async create(data: CreateTemplateData): Promise<Template> {
    const template = await this.prisma.template.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        isOfficial: data.isOfficial,
      },
    });

    return this.mapToTemplate(template);
  }

  /**
   * Find Template by ID
   */
  async findById(id: string): Promise<Template | null> {
    const template = await this.prisma.template.findUnique({
      where: { id },
    });

    if (!template) {
      return null;
    }

    return this.mapToTemplate(template);
  }

  /**
   * List templates with filtering and pagination (admin)
   */
  async list(filter: TemplateFilter): Promise<{ items: Template[]; total: number }> {
    const where: Prisma.TemplateWhereInput = {};

    // Search filter
    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    // Category filter
    if (filter.category) {
      where.category = filter.category;
    }

    // isOfficial filter
    if (filter.isOfficial !== undefined) {
      where.isOfficial = filter.isOfficial;
    }

    // isActive filter
    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    const [items, total] = await Promise.all([
      this.prisma.template.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.prisma.template.count({ where }),
    ]);

    return {
      items: items.map((t) => this.mapToTemplate(t)),
      total,
    };
  }

  /**
   * List public templates (active only) with latest active version.
   *
   * Performance: filters templates that have at least one active version
   * directly at the database level via `versions.some` instead of fetching
   * every template and filtering in JS. Combined with `take: 1` on the
   * included version, this keeps the payload bounded regardless of how many
   * historical versions exist per template.
   */
  async listPublic(): Promise<TemplateWithLatestVersion[]> {
    const templates = await this.prisma.template.findMany({
      where: {
        isActive: true,
        versions: { some: { isActive: true } },
      },
      include: {
        versions: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return templates.map((t) => ({
      ...this.mapToTemplate(t),
      latestVersion: t.versions[0]
        ? {
            id: t.versions[0].id,
            versionNumber: t.versions[0].versionNumber,
            createdAt: t.versions[0].createdAt,
          }
        : null,
    }));
  }

  /**
   * Update an existing Template
   */
  async update(id: string, patch: UpdateTemplateData): Promise<Template> {
    try {
      const template = await this.prisma.template.update({
        where: { id },
        data: {
          ...(patch.name !== undefined && { name: patch.name }),
          ...(patch.description !== undefined && { description: patch.description }),
          ...(patch.category !== undefined && { category: patch.category }),
          ...(patch.isOfficial !== undefined && { isOfficial: patch.isOfficial }),
          ...(patch.isActive !== undefined && { isActive: patch.isActive }),
        },
      });

      return this.mapToTemplate(template);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('TEMPLATE_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  /**
   * Delete a Template
   */
  async delete(id: string): Promise<void> {
    try {
      await this.prisma.template.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('TEMPLATE_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  /**
   * Link a template to its editable "source project" (admin authoring copy).
   */
  async setSourceProject(templateId: string, projectId: string): Promise<void> {
    try {
      await this.prisma.template.update({
        where: { id: templateId },
        data: { sourceProjectId: projectId },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new Error('TEMPLATE_NOT_FOUND');
      }
      throw error;
    }
  }

  /**
   * Count projects using this template or any of its versions
   */
  async countProjectsUsing(id: string): Promise<number> {
    const count = await this.prisma.project.count({
      where: {
        OR: [
          { templateId: id },
          {
            templateVersion: {
              templateId: id,
            },
          },
        ],
      },
    });

    return count;
  }

  /**
   * Batched usage count by template IDs.
   *
   * Runs two grouped queries (one for direct `templateId`, one via
   * `templateVersion.templateId`) and merges the results. Skips the query if
   * the input list is empty so we don't hammer Prisma with empty `IN ()`.
   */
  async countUsageByTemplateIds(
    templateIds: string[],
  ): Promise<Map<string, number>> {
    if (templateIds.length === 0) return new Map();

    const result = new Map<string, number>();

    // Direct templateId references on Project
    const direct = await this.prisma.project.groupBy({
      by: ['templateId'],
      where: { templateId: { in: templateIds } },
      _count: { _all: true },
    });
    for (const row of direct) {
      if (!row.templateId) continue;
      result.set(row.templateId, (result.get(row.templateId) ?? 0) + row._count._all);
    }

    // Indirect via templateVersionId → templateVersion.templateId
    const indirect = await this.prisma.project.findMany({
      where: {
        templateVersionId: { not: null },
        templateVersion: { templateId: { in: templateIds } },
      },
      select: { templateVersion: { select: { templateId: true } } },
    });
    for (const row of indirect) {
      const tid = row.templateVersion?.templateId;
      if (!tid) continue;
      result.set(tid, (result.get(tid) ?? 0) + 1);
    }

    return result;
  }

  /**
   * Create a new TemplateVersion
   */
  async createVersion(data: CreateVersionData): Promise<TemplateVersion> {
    try {
      const version = await this.prisma.templateVersion.create({
        data: {
          templateId: data.templateId,
          versionNumber: data.versionNumber,
          changelog: data.changelog,
          storageKey: data.storageKey,
          entryPath: data.entryPath,
        },
      });

      return this.mapToVersion(version);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Unique constraint violation
          throw new Error('VERSION_EXISTS');
        }
      }
      throw error;
    }
  }

  /**
   * Find TemplateVersion by ID
   */
  async findVersionById(versionId: string): Promise<TemplateVersion | null> {
    const version = await this.prisma.templateVersion.findUnique({
      where: { id: versionId },
    });

    if (!version) {
      return null;
    }

    return this.mapToVersion(version);
  }

  /**
   * List all versions of a template
   */
  async listVersionsByTemplate(templateId: string): Promise<TemplateVersion[]> {
    const versions = await this.prisma.templateVersion.findMany({
      where: { templateId },
      orderBy: { createdAt: 'desc' },
    });

    return versions.map((v) => this.mapToVersion(v));
  }

  /**
   * Set version active/inactive
   */
  async setVersionActive(versionId: string, isActive: boolean): Promise<TemplateVersion> {
    return this.updateVersion(versionId, { isActive });
  }

  /**
   * Update version metadata (changelog and/or isActive).
   *
   * Both fields are optional — only present keys are written. `changelog` may
   * be `null` to clear the existing note.
   */
  async updateVersion(
    versionId: string,
    patch: { changelog?: string | null; isActive?: boolean },
  ): Promise<TemplateVersion> {
    const data: Prisma.TemplateVersionUpdateInput = {};
    if (patch.changelog !== undefined) data.changelog = patch.changelog;
    if (patch.isActive !== undefined) data.isActive = patch.isActive;

    try {
      const version = await this.prisma.templateVersion.update({
        where: { id: versionId },
        data,
      });
      return this.mapToVersion(version);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('VERSION_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  /**
   * Map Prisma Template model to domain Template type
   */
  private mapToTemplate(prismaTemplate: {
    id: string;
    name: string;
    description: string | null;
    category: string;
    isOfficial: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    sourceProjectId: string | null;
  }): Template {
    return {
      id: prismaTemplate.id,
      name: prismaTemplate.name,
      description: prismaTemplate.description,
      category: prismaTemplate.category as TemplateCategory,
      isOfficial: prismaTemplate.isOfficial,
      isActive: prismaTemplate.isActive,
      createdAt: prismaTemplate.createdAt,
      updatedAt: prismaTemplate.updatedAt,
      sourceProjectId: prismaTemplate.sourceProjectId,
    };
  }

  /**
   * Map Prisma TemplateVersion model to domain TemplateVersion type
   */
  private mapToVersion(prismaVersion: {
    id: string;
    templateId: string;
    versionNumber: string;
    changelog: string | null;
    storageKey: string;
    entryPath: string;
    isActive: boolean;
    createdAt: Date;
  }): TemplateVersion {
    return {
      id: prismaVersion.id,
      templateId: prismaVersion.templateId,
      versionNumber: prismaVersion.versionNumber,
      changelog: prismaVersion.changelog,
      storageKey: prismaVersion.storageKey,
      entryPath: prismaVersion.entryPath,
      isActive: prismaVersion.isActive,
      createdAt: prismaVersion.createdAt,
    };
  }
}
