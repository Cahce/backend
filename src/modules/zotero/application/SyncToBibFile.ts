
import type {
  ZoteroConnectionRepo,
  ZoteroApiPort,
  ZoteroSyncLogRepo,
} from "../domain/Ports.js";
import type { BibliographyService } from "../../bibliography/application/BibliographyService.js";
import type { ProjectWriteAccessPolicy } from "../../projects/domain/access/ProjectAccessPolicies.js";
import { ZoteroNotConnectedError } from "../domain/Errors.js";
import { mapZoteroItemToBibEntry } from "../domain/Mapping.js";
import { dedupeKey } from "../../bibliography/domain/CitationKeyGen.js";
import { normalizeDoi } from "../../bibliography/domain/DuplicateDetection.js";

export interface SyncToBibFileCommand {
  userId: string;
  projectId: string;
  targetBibPath: string;
  syncType: "full" | "incremental";
  collectionKeys?: string[];
  itemKeys?: string[];
  conflictMode?: "skip" | "replace" | "rename";
}

export interface SyncToBibFileResult {
  syncLogId: string;
  itemsSynced: number;
  entries: Array<{ zoteroItemKey: string; citationKey: string }>;
}

export class SyncToBibFile {
  constructor(
    private readonly connRepo: ZoteroConnectionRepo,
    private readonly apiClient: ZoteroApiPort,
    private readonly bibliography: BibliographyService,
    private readonly logRepo: ZoteroSyncLogRepo,
    private readonly projectAccess: ProjectWriteAccessPolicy
  ) {}

  async execute(command: SyncToBibFileCommand): Promise<SyncToBibFileResult> {
    const {
      userId,
      projectId,
      targetBibPath,
      syncType,
      collectionKeys,
      itemKeys,
      conflictMode = "skip",
    } = command;

    await this.projectAccess.requireWriteAccess(projectId, userId);

    const conn = await this.connRepo.getByUserId(userId);
    if (!conn) {
      throw new ZoteroNotConnectedError();
    }

    const log = await this.logRepo.create({
      connectionId: conn.id,
      projectId,
      syncType,
    });

    await this.logRepo.markRunning(log.id);

    try {
      const items = await this.fetchAllItems(conn.accessToken, conn.libraryType, conn.libraryId, {
        collectionKeys,
        itemKeys,
      });

      const existing = await this.bibliography.readBibFile(projectId, targetBibPath);
      const existingKeys = new Set(existing.map(e => e.key));
      const existingByDoi = new Map<string, string>();
      for (const e of existing) {
        const doi = normalizeDoi(e.fields.doi);
        if (doi) existingByDoi.set(doi, e.key);
      }

      const newEntries: typeof existing = [];
      const entryMapping: Array<{ zoteroItemKey: string; citationKey: string }> =
        [];

      for (const item of items) {
        const doi = normalizeDoi(item.DOI);
        if (doi && existingByDoi.has(doi)) {
          const existingKey = existingByDoi.get(doi)!;

          if (conflictMode === "skip") {
            entryMapping.push({
              zoteroItemKey: item.key,
              citationKey: existingKey,
            });
            continue;
          }

          const entry = mapZoteroItemToBibEntry(item);
          if (conflictMode === "replace") {
            entry.key = existingKey;
          } else {
            entry.key = dedupeKey(entry.key, existingKeys);
            existingKeys.add(entry.key);
          }

          existingByDoi.set(doi, entry.key);
          newEntries.push(entry);
          entryMapping.push({
            zoteroItemKey: item.key,
            citationKey: entry.key,
          });
          continue;
        }

        const entry = mapZoteroItemToBibEntry(item);
        if (existingKeys.has(entry.key)) {
          if (conflictMode === "skip") {
            entryMapping.push({
              zoteroItemKey: item.key,
              citationKey: entry.key,
            });
            continue;
          }

          if (conflictMode === "rename") {
            entry.key = dedupeKey(entry.key, existingKeys);
          }
        } else {
          entry.key = dedupeKey(entry.key, existingKeys);
        }
        existingKeys.add(entry.key);
        if (doi) existingByDoi.set(doi, entry.key);
        newEntries.push(entry);
        entryMapping.push({
          zoteroItemKey: item.key,
          citationKey: entry.key,
        });
      }

      const merged = this.bibliography.mergeEntries(existing, newEntries);

      if (newEntries.length > 0) {
        await this.bibliography.writeBibFile(projectId, targetBibPath, merged);
      }

      await this.connRepo.touchLastSyncedAt(conn.id);

      await this.logRepo.markSuccess(log.id, newEntries.length);

      return {
        syncLogId: log.id,
        itemsSynced: newEntries.length,
        entries: entryMapping,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.logRepo.markFailed(log.id, errorMessage);
      throw error;
    }
  }

  private async fetchAllItems(
    apiKey: string,
    libraryType: "user" | "group",
    libraryId: string,
    filters: {
      collectionKeys?: string[];
      itemKeys?: string[];
    }
  ) {
    const allItems = [];

    if (filters.itemKeys && filters.itemKeys.length > 0) {
      return this.apiClient.getItemsByKeys(libraryType, libraryId, filters.itemKeys, apiKey);
    }

    if (filters.collectionKeys && filters.collectionKeys.length > 0) {
      for (const collectionKey of filters.collectionKeys) {
        const items = await this.fetchItemsFromCollection(
          apiKey,
          libraryType,
          libraryId,
          collectionKey
        );
        allItems.push(...items);
      }
      return allItems;
    }

    return this.fetchItemsFromCollection(apiKey, libraryType, libraryId);
  }

  private async fetchItemsFromCollection(
    apiKey: string,
    libraryType: "user" | "group",
    libraryId: string,
    collectionKey?: string
  ) {
    const allItems = [];
    let start = 0;
    const limit = 100;

    while (true) {
      const result = await this.apiClient.listItems({
        libraryType,
        libraryId,
        apiKey,
        collectionKey,
        start,
        limit,
      });

      allItems.push(...result.items);

      if (start + result.items.length >= result.total) {
        break;
      }

      start += limit;
    }

    return allItems;
  }
}
