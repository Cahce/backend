/**
 * OpenAlex Import Log Repository - Prisma Implementation
 * 
 * Implements OpenAlexImportLogRepo using Prisma ORM.
 */

import type { PrismaClient } from "../../../generated/prisma/index.js";
import type {
  OpenAlexImportLogRepo,
  OpenAlexImportLogRecord,
  OpenAlexImportLogCreateInput,
} from "../domain/Ports.js";
import type { OpenAlexImportStatus } from "../domain/Types.js";

export class OpenAlexImportLogRepoPrisma implements OpenAlexImportLogRepo {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    userId: string;
    projectId: string;
    openAlexId: string;
    citationKey: string;
    targetBibPath: string;
    doi?: string | null;
    title?: string | null;
    year?: number | null;
    status: OpenAlexImportStatus;
    errorMessage?: string | null;
  }): Promise<OpenAlexImportLogRecord> {
    const log = await this.prisma.openAlexImportLog.create({
      data: {
        userId: data.userId,
        projectId: data.projectId,
        openAlexId: data.openAlexId,
        citationKey: data.citationKey,
        targetBibPath: data.targetBibPath,
        doi: data.doi ?? null,
        title: data.title ?? null,
        year: data.year ?? null,
        status: data.status,
        errorMessage: data.errorMessage ?? null,
      },
    });

    return log;
  }

  async createMany(rows: OpenAlexImportLogCreateInput[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    await this.prisma.openAlexImportLog.createMany({
      data: rows.map((r) => ({
        userId: r.userId,
        projectId: r.projectId,
        openAlexId: r.openAlexId,
        citationKey: r.citationKey,
        targetBibPath: r.targetBibPath,
        doi: r.doi ?? null,
        title: r.title ?? null,
        year: r.year ?? null,
        status: r.status,
        errorMessage: r.errorMessage ?? null,
      })),
    });
  }

  async findImportedByProjectAndOpenAlexIds(
    projectId: string,
    openAlexIds: string[]
  ): Promise<OpenAlexImportLogRecord[]> {
    if (openAlexIds.length === 0) {
      return [];
    }
    const logs = await this.prisma.openAlexImportLog.findMany({
      where: {
        projectId,
        openAlexId: { in: openAlexIds },
        status: "imported",
      },
      orderBy: {
        importedAt: "desc",
      },
    });

    return logs;
  }

  async findByProjectAndOpenAlexId(
    projectId: string,
    openAlexId: string
  ): Promise<OpenAlexImportLogRecord | null> {
    const log = await this.prisma.openAlexImportLog.findFirst({
      where: {
        projectId,
        openAlexId,
        status: "imported",
      },
      orderBy: {
        importedAt: "desc",
      },
    });

    return log;
  }

  async listByProject(
    projectId: string,
    limit: number = 50
  ): Promise<OpenAlexImportLogRecord[]> {
    const logs = await this.prisma.openAlexImportLog.findMany({
      where: {
        projectId,
      },
      orderBy: {
        importedAt: "desc",
      },
      take: limit,
    });

    return logs;
  }
}
