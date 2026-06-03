/**
 * List Items Use Case
 * 
 * Lists items from the user's Zotero library or a specific collection.
 */

import type { ZoteroConnectionRepo, ZoteroApiPort } from "../domain/Ports.js";
import type { ZoteroItem } from "../domain/Types.js";
import { ZoteroNotConnectedError } from "../domain/Errors.js";

/**
 * Command to list items
 */
export interface ListItemsCommand {
  userId: string;
  collectionKey?: string;
  start?: number;
  limit?: number;
  sort?: string;
  direction?: "asc" | "desc";
}

/**
 * Result of listing items
 */
export interface ListItemsResult {
  items: ZoteroItem[];
  total: number;
}

/**
 * List Items Use Case
 */
export class ListItems {
  constructor(
    private readonly connRepo: ZoteroConnectionRepo,
    private readonly apiClient: ZoteroApiPort
  ) {}

  async execute(command: ListItemsCommand): Promise<ListItemsResult> {
    const { userId, collectionKey, start = 0, limit = 100, sort, direction } = command;

    // Load connection
    const conn = await this.connRepo.getByUserId(userId);
    if (!conn) {
      throw new ZoteroNotConnectedError();
    }

    // Fetch items from Zotero API
    const result = await this.apiClient.listItems({
      libraryType: conn.libraryType,
      libraryId: conn.libraryId,
      apiKey: conn.accessToken,
      collectionKey,
      start,
      limit,
      sort,
      direction,
    });

    return result;
  }
}
