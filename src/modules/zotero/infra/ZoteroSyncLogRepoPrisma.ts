
import type { PrismaClient } from "../../../generated/prisma/index.js";
import type { ZoteroSyncLogRepo } from "../domain/Ports.js";
import type { ZoteroSyncLogRecord } from "../domain/Types.js";

export class ZoteroSyncLogRepoPrisma implements ZoteroSyncLogRepo {
  constructor(private readonly prisma: PrismaClient) {}

  async create(args: {
    connectionId: string;
    projectId?: string;
    syncType: "full" | "incremental";
  }): Promise<{ id: string }> {
    const log = await this.prisma.zoteroSyncLog.create({
      data: {
        connectionId: args.connectionId,
        projectId: args.projectId || null,
        syncType: args.syncType,
        status: "pending",
        itemsSynced: 0,
      },
    });

    return { id: log.id };
  }

  async markRunning(id: string): Promise<void> {
    await this.prisma.zoteroSyncLog.update({
      where: { id },
      data: {
        status: "running",
        startedAt: new Date(),
      },
    });
  }

  async markSuccess(id: string, itemsSynced: number): Promise<void> {
    await this.prisma.zoteroSyncLog.update({
      where: { id },
      data: {
        status: "success",
        itemsSynced,
        finishedAt: new Date(),
      },
    });
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    await this.prisma.zoteroSyncLog.update({
      where: { id },
      data: {
        status: "failed",
        errorMessage,
        finishedAt: new Date(),
      },
    });
  }

  async listByProject(projectId: string, limit: number): Promise<ZoteroSyncLogRecord[]> {
    const logs = await this.prisma.zoteroSyncLog.findMany({
      where: { projectId },
      orderBy: { startedAt: "desc" },
      take: limit,
    });

    return logs.map((log: any) => ({
      id: log.id,
      connectionId: log.connectionId,
      projectId: log.projectId,
      syncType: log.syncType as "full" | "incremental",
      status: log.status as "pending" | "running" | "success" | "failed",
      itemsSynced: log.itemsSynced,
      errorMessage: log.errorMessage,
      startedAt: log.startedAt,
      finishedAt: log.finishedAt,
    }));
  }
}
