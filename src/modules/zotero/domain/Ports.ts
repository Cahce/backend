
import type {
  ZoteroItem,
  ZoteroCollection,
  ZoteroConnectionRecord,
  ZoteroSyncLogRecord,
} from "./Types.js";

export interface ZoteroKeyInfo {
  userId: string;
  username: string;
  displayName?: string;
  access: {
    user?: { library?: boolean; files?: boolean; notes?: boolean; write?: boolean };
    groups?: Record<string, { library?: boolean; write?: boolean }>;
  };
}

export interface ZoteroGroupSummary {
  id: string;
  name: string;
}

export interface ZoteroApiPort {
  verifyKey(
    libraryType: "user" | "group",
    libraryId: string,
    apiKey: string
  ): Promise<void>;

  getKeyInfo(apiKey: string): Promise<ZoteroKeyInfo>;

  listGroups(userId: string, apiKey: string): Promise<ZoteroGroupSummary[]>;

  listCollections(
    libraryType: "user" | "group",
    libraryId: string,
    apiKey: string
  ): Promise<ZoteroCollection[]>;

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

  getItem(
    libraryType: "user" | "group",
    libraryId: string,
    itemKey: string,
    apiKey: string
  ): Promise<ZoteroItem>;

  getItemsByKeys(
    libraryType: "user" | "group",
    libraryId: string,
    itemKeys: string[],
    apiKey: string
  ): Promise<ZoteroItem[]>;

  createItems(
    libraryType: "user" | "group",
    libraryId: string,
    apiKey: string,
    items: ZoteroItem[]
  ): Promise<{ successKeys: string[]; failed: { index: number; message: string }[] }>;
}

export interface ZoteroConnectionRepo {
  getByUserId(userId: string): Promise<ZoteroConnectionRecord | null>;

  upsert(
    record: Omit<ZoteroConnectionRecord, "id" | "connectedAt" | "lastSyncedAt">
  ): Promise<ZoteroConnectionRecord>;

  deleteByUserId(userId: string): Promise<void>;

  touchLastSyncedAt(connectionId: string): Promise<void>;
}

export interface ZoteroSyncLogRepo {
  create(args: {
    connectionId: string;
    projectId?: string;
    syncType: "full" | "incremental";
  }): Promise<{ id: string }>;

  markRunning(id: string): Promise<void>;

  markSuccess(id: string, itemsSynced: number): Promise<void>;

  markFailed(id: string, errorMessage: string): Promise<void>;

  listByProject(projectId: string, limit: number): Promise<ZoteroSyncLogRecord[]>;
}
