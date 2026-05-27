/**
 * Get My Connection Use Case
 * 
 * Retrieves the current user's Zotero connection status.
 */

import type { ZoteroConnectionRepo } from "../domain/Ports.js";

/**
 * Command to get user's Zotero connection
 */
export interface GetMyConnectionCommand {
  userId: string;
}

/**
 * Connection DTO (without sensitive data)
 */
export interface ConnectionDto {
  id: string;
  libraryId: string;
  libraryType: "user" | "group";
  connectedAt: Date;
  lastSyncedAt: Date | null;
  hasApiKey: boolean;
}

/**
 * Result of getting connection
 */
export interface GetMyConnectionResult {
  connection: ConnectionDto | null;
}

/**
 * Get My Connection Use Case
 */
export class GetMyConnection {
  constructor(private readonly connRepo: ZoteroConnectionRepo) {}

  async execute(command: GetMyConnectionCommand): Promise<GetMyConnectionResult> {
    const { userId } = command;

    // Get connection
    const conn = await this.connRepo.getByUserId(userId);

    if (!conn) {
      return { connection: null };
    }

    // Convert to DTO (exclude accessToken)
    const dto: ConnectionDto = {
      id: conn.id,
      libraryId: conn.libraryId,
      libraryType: conn.libraryType,
      connectedAt: conn.connectedAt,
      lastSyncedAt: conn.lastSyncedAt,
      hasApiKey: true,
    };

    return { connection: dto };
  }
}
