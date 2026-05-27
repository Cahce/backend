/**
 * Disconnect Zotero Use Case
 * 
 * Disconnects a user's Zotero account.
 */

import type { ZoteroConnectionRepo } from "../domain/Ports.js";
import { ZoteroNotConnectedError } from "../domain/Errors.js";

/**
 * Command to disconnect Zotero account
 */
export interface DisconnectZoteroCommand {
  userId: string;
}

/**
 * Result of disconnecting Zotero account
 */
export interface DisconnectZoteroResult {
  success: boolean;
}

/**
 * Disconnect Zotero Use Case
 */
export class DisconnectZotero {
  constructor(private readonly connRepo: ZoteroConnectionRepo) {}

  async execute(command: DisconnectZoteroCommand): Promise<DisconnectZoteroResult> {
    const { userId } = command;

    // Check if connection exists
    const existing = await this.connRepo.getByUserId(userId);
    if (!existing) {
      throw new ZoteroNotConnectedError();
    }

    // Delete connection
    await this.connRepo.deleteByUserId(userId);

    return { success: true };
  }
}
