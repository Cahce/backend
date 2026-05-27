/**
 * List Collections Use Case
 * 
 * Lists collections from the user's Zotero library.
 */

import type { ZoteroConnectionRepo, ZoteroApiPort } from "../domain/Ports.js";
import type { ZoteroCollection } from "../domain/Types.js";
import { ZoteroNotConnectedError } from "../domain/Errors.js";

/**
 * Command to list collections
 */
export interface ListCollectionsCommand {
  userId: string;
}

/**
 * Result of listing collections
 */
export interface ListCollectionsResult {
  collections: ZoteroCollection[];
}

/**
 * List Collections Use Case
 */
export class ListCollections {
  constructor(
    private readonly connRepo: ZoteroConnectionRepo,
    private readonly apiClient: ZoteroApiPort
  ) {}

  async execute(command: ListCollectionsCommand): Promise<ListCollectionsResult> {
    const { userId } = command;

    // Load connection
    const conn = await this.connRepo.getByUserId(userId);
    if (!conn) {
      throw new ZoteroNotConnectedError();
    }

    // Fetch collections from Zotero API
    const collections = await this.apiClient.listCollections(
      conn.libraryType,
      conn.libraryId,
      conn.accessToken
    );

    return { collections };
  }
}
