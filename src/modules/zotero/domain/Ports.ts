/**
 * Zotero Domain Ports
 * 
 * Interfaces for external dependencies.
 * No framework dependencies.
 */

import type {
  ZoteroItem,
  ZoteroCollection,
  ZoteroConnectionRecord,
  ZoteroSyncLogRecord,
} from "./Types.js";

/**
 * Information about a Zotero API key returned by GET /keys/current.
 */
export interface ZoteroKeyInfo {
  userId: string;
  username: string;
  displayName?: string;
  access: {
    user?: { library?: boolean; files?: boolean; notes?: boolean; write?: boolean };
    groups?: Record<string, { library?: boolean; write?: boolean }>;
  };
}

/**
 * Summary of a Zotero group library the user can access.
 */
export interface ZoteroGroupSummary {
  id: string;
  name: string;
}

/**
 * Zotero API client port
 *
 * Abstracts communication with Zotero API.
 */
export interface ZoteroApiPort {
  /**
   * Verify API key by making a test request
   * @throws ZoteroAuthError if authentication fails
   */
  verifyKey(
    libraryType: "user" | "group",
    libraryId: string,
    apiKey: string
  ): Promise<void>;

  /**
   * Look up the numeric user ID and access scopes for an API key.
   */
  getKeyInfo(apiKey: string): Promise<ZoteroKeyInfo>;

  /**
   * List groups accessible to the user / API key.
   * Returns an empty array if the user has no groups.
   */
  listGroups(userId: string, apiKey: string): Promise<ZoteroGroupSummary[]>;

  /**
   * List collections in a library
   */
  listCollections(
    libraryType: "user" | "group",
    libraryId: string,
    apiKey: string
  ): Promise<ZoteroCollection[]>;

  /**
   * List items in a library or collection
   */
  listItems(args: {
    libraryType: "user" | "group";
    libraryId: string;
    apiKey: string;
    collectionKey?: string;
    start?: number;
    limit?: number;
    sort?: string;
    direction?: "asc" | "desc";
  }): Promise<{ items: ZoteroItem[]; total: number }>;

  /**
   * Get a single item by key
   */
  getItem(
    libraryType: "user" | "group",
    libraryId: string,
    itemKey: string,
    apiKey: string
  ): Promise<ZoteroItem>;

  /**
   * Batch-fetch items by key (chunked into ≤50 per request). Missing keys are
   * simply absent from the result. Replaces N individual getItem round-trips.
   */
  getItemsByKeys(
    libraryType: "user" | "group",
    libraryId: string,
    itemKeys: string[],
    apiKey: string
  ): Promise<ZoteroItem[]>;

  /**
   * Create one or more items in a library (write). Requires a write-enabled
   * API key. Returns the keys of items created successfully plus any failures.
   */
  createItems(
    libraryType: "user" | "group",
    libraryId: string,
    apiKey: string,
    items: ZoteroItem[]
  ): Promise<{ successKeys: string[]; failed: { index: number; message: string }[] }>;
}

/**
 * Zotero connection repository port
 */
export interface ZoteroConnectionRepo {
  /**
   * Get connection by user ID
   */
  getByUserId(userId: string): Promise<ZoteroConnectionRecord | null>;

  /**
   * Create or update connection
   */
  upsert(
    record: Omit<ZoteroConnectionRecord, "id" | "connectedAt" | "lastSyncedAt">
  ): Promise<ZoteroConnectionRecord>;

  /**
   * Delete connection by user ID
   */
  deleteByUserId(userId: string): Promise<void>;

  /**
   * Update lastSyncedAt timestamp
   */
  touchLastSyncedAt(connectionId: string): Promise<void>;
}

/**
 * Zotero sync log repository port
 */
export interface ZoteroSyncLogRepo {
  /**
   * Create a new sync log entry
   */
  create(args: {
    connectionId: string;
    projectId?: string;
    syncType: "full" | "incremental";
  }): Promise<{ id: string }>;

  /**
   * Mark sync as running
   */
  markRunning(id: string): Promise<void>;

  /**
   * Mark sync as successful
   */
  markSuccess(id: string, itemsSynced: number): Promise<void>;

  /**
   * Mark sync as failed
   */
  markFailed(id: string, errorMessage: string): Promise<void>;

  /**
   * List sync logs for a project
   */
  listByProject(projectId: string, limit: number): Promise<ZoteroSyncLogRecord[]>;
}
