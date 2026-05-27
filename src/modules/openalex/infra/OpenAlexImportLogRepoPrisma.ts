/**
 * OpenAlex Import Log Repository - Prisma Implementation
 * 
 * Implements OpenAlexImportLogRepo using Prisma ORM.
 */

import type { OpenAlexImportStatus } from "../../../generated/prisma/index.js";
import type { OpenAlexImportLogRepo, OpenAlexImportLogRecord } from "../domain/Ports.js";

export class OpenAlexImportLogRepoPrisma implements OpenAlexImportLogRepo {
  constructor(private readonly prisma: any) {}

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
