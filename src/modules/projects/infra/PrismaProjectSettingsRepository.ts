import type { PrismaClient, ProjectSettings as PrismaProjectSettings } from "../../../generated/prisma/index.js";
import { Prisma } from "../../../generated/prisma/index.js";
import type { ProjectSettingsRepository } from "../domain/ProjectSettingsRepository.js";
import { ProjectSettings, type CompileOptions, type ZoteroConfig } from "../domain/ProjectSettings.js";

export class PrismaProjectSettingsRepository implements ProjectSettingsRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async findOrCreate(projectId: string): Promise<ProjectSettings> {
        const existing = await this.prisma.projectSettings.findUnique({
            where: { projectId },
        });

        if (existing) {
            return this.toDomain(existing);
        }

        const created = await this.prisma.projectSettings.create({
            data: {
                projectId,
                mainPath: "main.typ",
                compileOptions: Prisma.JsonNull,
                zoteroConfig: Prisma.JsonNull,
            },
        });

        return this.toDomain(created);
    }

    async update(settings: ProjectSettings): Promise<ProjectSettings> {
        const updated = await this.prisma.projectSettings.update({
            where: { projectId: settings.projectId },
            data: {
                mainPath: settings.mainPath,
                compileOptions: settings.compileOptions as Prisma.InputJsonValue,
                zoteroConfig: settings.zoteroConfig === null
                    ? Prisma.JsonNull
                    : (settings.zoteroConfig as Prisma.InputJsonValue),
                updatedAt: new Date(),
            },
        });

        return this.toDomain(updated);
    }

    private toDomain(row: PrismaProjectSettings): ProjectSettings {
        return new ProjectSettings(
            row.projectId,
            row.mainPath,
            (row.compileOptions as CompileOptions) ?? {},
            (row.zoteroConfig as ZoteroConfig) ?? null,
            row.updatedAt,
        );
    }
}
