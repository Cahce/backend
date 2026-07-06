
import type { ZoteroSyncLogRepo } from "../domain/Ports.js";
import type { ZoteroSyncLogRecord } from "../domain/Types.js";
import type { ProjectAccessPolicy } from "../../projects/domain/access/ProjectAccessPolicies.js";

export interface GetSyncLogsCommand {
  userId: string;
  projectId: string;
  limit?: number;
}

export interface GetSyncLogsResult {
  logs: ZoteroSyncLogRecord[];
}

export class GetSyncLogs {
  constructor(
    private readonly logRepo: ZoteroSyncLogRepo,
    private readonly projectAccess: ProjectAccessPolicy
  ) {}

  async execute(command: GetSyncLogsCommand): Promise<GetSyncLogsResult> {
    const { userId, projectId, limit = 50 } = command;

    await this.projectAccess.requireProjectAccess(projectId, userId);

    const logs = await this.logRepo.listByProject(projectId, limit);

    return { logs };
  }
}
