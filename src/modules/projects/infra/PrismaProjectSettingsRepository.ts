import type { PrismaClient, ProjectSettings as PrismaProjectSettings } from "../../../generated/prisma/index.js";
import { Prisma } from "../../../generated/prisma/index.js";
import type { ProjectSettingsRepository } from "../domain/ProjectSettingsRepository.js";
import { ProjectSettings, type CompileOptions, type ZoteroConfig, type OpenAlexConfig } from "../domain/ProjectSettings.js";
import { accessFor, lockProject, appendProjectEvent } from './CollaborationTransaction.js';
import { CollaborationError, requireCondition } from '../domain/access/CollaborationErrors.js';

export class PrismaProjectSettingsRepository implements ProjectSettingsRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async findOrCreate(projectId: string): Promise<ProjectSettings> {
        const existing = await this.prisma.projectSettings.findUnique({
            where: { projectId },
        });

        if (existing) {
            return this.toDomain(existing);
        }

        const created = await this.prisma.projectSettings.upsert({
            where: { projectId }, update: {}, create: {
                projectId,
                mainPath: "main.typ",
                compileOptions: Prisma.JsonNull,
                zoteroConfig: Prisma.JsonNull,
                openalexConfig: Prisma.JsonNull,
            },
        });

        return this.toDomain(created);
    }

    async update(settings: ProjectSettings, options?: { actorId: string; baseRevision?: number; privateConfig?: boolean }): Promise<ProjectSettings> {
      try {
        const updated = await this.prisma.$transaction(async tx => {
          await lockProject(tx, settings.projectId);
          if (options) {
            const access = await accessFor(tx, settings.projectId, { userId: options.actorId, role: 'student' });
            requireCondition(access.canManageSettings, 'PROJECT_ACCESS_DENIED', 'Bạn không có quyền sửa thiết lập');
            requireCondition(!options.privateConfig || access.level === 'owner', 'FORBIDDEN', 'Chỉ chủ dự án được sửa kết nối riêng');
          }
          const updated = await tx.projectSettings.update({
            where: { projectId: settings.projectId, ...(options?.baseRevision ? { revision: options.baseRevision } : {}) },
            data: {
                revision: { increment: 1 },
                mainPath: settings.mainPath,
                compileOptions: settings.compileOptions as Prisma.InputJsonValue,
                zoteroConfig: settings.zoteroConfig === null
                    ? Prisma.JsonNull
                    : (settings.zoteroConfig as Prisma.InputJsonValue),
                openalexConfig: settings.openalexConfig === null
                    ? Prisma.JsonNull
                    : (settings.openalexConfig as Prisma.InputJsonValue),
                updatedAt: new Date(),
            },
        });
          await appendProjectEvent(tx, settings.projectId, 'project.settings.updated', settings.projectId, options?.actorId ?? null);
          return updated;
        });
        return this.toDomain(updated);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025')
          throw new CollaborationError('SETTINGS_VERSION_CONFLICT', 'Thiết lập đã thay đổi. Hãy tải lại', 409);
        throw error;
      }
    }

    private toDomain(row: PrismaProjectSettings): ProjectSettings {
        return new ProjectSettings(
            row.projectId,
            row.mainPath,
            (row.compileOptions as CompileOptions) ?? {},
            (row.zoteroConfig as ZoteroConfig) ?? null,
            (row.openalexConfig as OpenAlexConfig) ?? null,
            row.updatedAt,
            row.revision,
        );
    }
}
