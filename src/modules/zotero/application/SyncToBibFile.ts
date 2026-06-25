/**
 * Sync To Bib File Use Case
 * 
 * Syncs Zotero items to a project's .bib file.
 * Core logic: fetch items → map to BibEntry → merge with existing → write file.
 */

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

/**
 * Command to sync Zotero items to .bib file
 */
export interface SyncToBibFileCommand {
  userId: string;
  projectId: string;
  targetBibPath: string;
  syncType: "full" | "incremental";
  collectionKeys?: string[];
  itemKeys?: string[];
  conflictMode?: "skip" | "replace" | "rename";
}

/**
 * Result of sync operation
 */
export interface SyncToBibFileResult {
  syncLogId: string;
  itemsSynced: number;
  /**
   * Per-item mapping from the Zotero item key to the citation key actually
   * written in the .bib file. Lets the frontend insert `#cite(<citationKey>)`
   * that matches the entry the backend just persisted.
   */
  entries: Array<{ zoteroItemKey: string; citationKey: string }>;
}

/**
 * Sync To Bib File Use Case
 */
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

    // Verify write access (owner or editor member; viewers/admin-oversight denied)
    await this.projectAccess.requireWriteAccess(projectId, userId);

    // Load connection
    const conn = await this.connRepo.getByUserId(userId);
    if (!conn) {
      throw new ZoteroNotConnectedError();
    }

    // Create sync log
    const log = await this.logRepo.create({
      connectionId: conn.id,
      projectId,
      syncType,
    });

    // Mark as running
    await this.logRepo.markRunning(log.id);

    try {
      // 1. Fetch items from Zotero
      const items = await this.fetchAllItems(conn.accessToken, conn.libraryType, conn.libraryId, {
        collectionKeys,
        itemKeys,
      });

      // 2. Read existing .bib file
      const existing = await this.bibliography.readBibFile(projectId, targetBibPath);
      const existingKeys = new Set(existing.map(e => e.key));
      // DOI index used for idempotency: when a Zotero item with a known DOI is
      // re-synced (e.g. user clicks "Chèn" twice), reuse the existing entry's
      // key instead of appending a Cite[a-z] dedup suffix that creates a near-
      // duplicate.
      const existingByDoi = new Map<string, string>();
      for (const e of existing) {
        const doi = normalizeDoi(e.fields.doi);
        if (doi) existingByDoi.set(doi, e.key);
      }

      // 3. Map Zotero items to BibEntry, dedupe keys, and remember which
      //    Zotero key was used for which citation key (returned to caller).
      const newEntries: typeof existing = [];
      const entryMapping: Array<{ zoteroItemKey: string; citationKey: string }> =
        [];

      for (const item of items) {
        const doi = normalizeDoi(item.DOI);
        if (doi && existingByDoi.has(doi)) {
          const existingKey = existingByDoi.get(doi)!;

          if (conflictMode === "skip") {
            // Same paper already in bib: reuse its key and avoid silently
            // overwriting user edits.
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

      // 4. Merge with existing entries
      const merged = this.bibliography.mergeEntries(existing, newEntries);

      // 5. Write to file (skip the round-trip if nothing actually changed)
      if (newEntries.length > 0) {
        await this.bibliography.writeBibFile(projectId, targetBibPath, merged);
      }

      // 6. Update connection lastSyncedAt
      await this.connRepo.touchLastSyncedAt(conn.id);

      // 7. Mark sync as successful
      await this.logRepo.markSuccess(log.id, newEntries.length);

      return {
        syncLogId: log.id,
        itemsSynced: newEntries.length,
        entries: entryMapping,
      };
    } catch (error) {
      // Mark sync as failed
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.logRepo.markFailed(log.id, errorMessage);
      throw error;
    }
  }

  /**
   * Fetch all items based on filters
   * Handles pagination automatically.
   */
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

    // If specific item keys are provided, fetch them in ONE batched request
    // (chunked ≤50 by the client) instead of one getItem round-trip per key.
    if (filters.itemKeys && filters.itemKeys.length > 0) {
      return this.apiClient.getItemsByKeys(libraryType, libraryId, filters.itemKeys, apiKey);
    }

    // If collection keys are provided, fetch items from each collection
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

    // Otherwise, fetch all library items
    return this.fetchItemsFromCollection(apiKey, libraryType, libraryId);
  }

  /**
   * Fetch all items from a collection (or entire library if no collection specified)
   * Handles pagination.
   */
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

      // Check if we've fetched all items
      if (start + result.items.length >= result.total) {
        break;
      }

      start += limit;
    }

    return allItems;
  }
}
