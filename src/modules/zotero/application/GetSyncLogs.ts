/**
 * Get Sync Logs Use Case
 * 
 * Retrieves synchronization history for a project.
 */

import type { ZoteroSyncLogRepo } from "../domain/Ports.js";
import type { ZoteroSyncLogRecord } from "../domain/Types.js";
import type { ProjectAccessPolicy } from "../../projects/domain/access/ProjectAccessPolicies.js";

/**
 * Command to get sync logs
 */
export interface GetSyncLogsCommand {
  userId: string;
  projectId: string;
  limit?: number;
}

/**
 * Result of getting sync logs
 */
export interface GetSyncLogsResult {
  logs: ZoteroSyncLogRecord[];
}

/**
 * Get Sync Logs Use Case
 */
export class GetSyncLogs {
  constructor(
    private readonly logRepo: ZoteroSyncLogRepo,
    private readonly projectAccess: ProjectAccessPolicy
  ) {}

  async execute(command: GetSyncLogsCommand): Promise<GetSyncLogsResult> {
    const { userId, projectId, limit = 50 } = command;

    // Verify project access
    await this.projectAccess.requireProjectAccess(projectId, userId);

    // Fetch logs
    const logs = await this.logRepo.listByProject(projectId, limit);

    return { logs };
  }
}
