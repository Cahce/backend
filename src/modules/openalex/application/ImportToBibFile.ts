/**
 * Import To Bib File Use Case
 *
 * Imports OpenAlex works to a project's .bib file.
 * Tracks import history to prevent duplicates.
 *
 * Performance: the dedupe pre-pass is a single batched query, OpenAlex works are
 * fetched with bounded concurrency (not one serial await per id), and all import
 * log rows are flushed once via createMany — instead of the previous
 * three-N+1 pattern (per-id findFirst + per-id HTTP + per-id INSERT).
 */

import type {
  OpenAlexApiPort,
  OpenAlexImportLogRepo,
  OpenAlexImportLogCreateInput,
} from "../domain/Ports.js";
import type { BibliographyService } from "../../bibliography/application/BibliographyService.js";
import type { ProjectWriteAccessPolicy } from "../../projects/domain/access/ProjectAccessPolicies.js";
import { mapOpenAlexWorkToBibEntry } from "../domain/Mapping.js";
import { dedupeKey } from "../../bibliography/domain/CitationKeyGen.js";
import { normalizeDoi } from "../../bibliography/domain/DuplicateDetection.js";
import { mapWithConcurrency } from "../../../shared/async/mapWithConcurrency.js";

/**
 * Max simultaneous OpenAlex work fetches. Bounded so a 50-id import neither
 * serializes (slow) nor fires 50 requests at once (rate-limit risk).
 */
const OPENALEX_FETCH_CONCURRENCY = 5;

/**
 * Command to import works to .bib file
 */
export interface ImportToBibFileCommand {
  userId: string;
  projectId: string;
  openAlexIds: string[];
  targetBibPath: string;
  conflictMode?: "skip" | "replace" | "rename";
}

/**
 * Result of import operation with detailed status
 */
export interface ImportToBibFileResult {
  imported: Array<{ openAlexId: string; citationKey: string }>;
  skippedDuplicate: Array<{ openAlexId: string; existingKey: string }>;
  failed: Array<{ openAlexId: string; errorMessage: string }>;
}

/**
 * Import To Bib File Use Case
 */
export class ImportToBibFile {
  constructor(
    private readonly apiClient: OpenAlexApiPort,
    private readonly bibliography: BibliographyService,
    private readonly projectAccess: ProjectWriteAccessPolicy,
    private readonly importLogRepo: OpenAlexImportLogRepo
  ) {}

  async execute(command: ImportToBibFileCommand): Promise<ImportToBibFileResult> {
    const {
      userId,
      projectId,
      openAlexIds,
      targetBibPath,
      conflictMode = "skip",
    } = command;

    // Verify write access (owner or editor member; viewers/admin-oversight denied)
    await this.projectAccess.requireWriteAccess(projectId, userId);

    const result: ImportToBibFileResult = {
      imported: [],
      skippedDuplicate: [],
      failed: [],
    };

    // Import-log rows are accumulated and flushed once via createMany at the end.
    const logRows: OpenAlexImportLogCreateInput[] = [];

    // Dedupe pre-pass: ONE query for all ids (previously one findFirst per id).
    const existingLogs = await this.importLogRepo.findImportedByProjectAndOpenAlexIds(
      projectId,
      openAlexIds,
    );
    const existingLogByOpenAlexId = new Map<string, (typeof existingLogs)[number]>();
    for (const log of existingLogs) {
      if (!existingLogByOpenAlexId.has(log.openAlexId)) {
        existingLogByOpenAlexId.set(log.openAlexId, log);
      }
    }

    const toImport: string[] = [];
    const existingImportKeys = new Map<string, string>();
    for (const openAlexId of openAlexIds) {
      const existing = existingLogByOpenAlexId.get(openAlexId);
      if (existing) {
        existingImportKeys.set(openAlexId, existing.citationKey);

        if (conflictMode === "skip") {
          result.skippedDuplicate.push({
            openAlexId,
            existingKey: existing.citationKey,
          });
          logRows.push({
            userId,
            projectId,
            openAlexId,
            citationKey: existing.citationKey,
            targetBibPath,
            doi: existing.doi,
            title: existing.title,
            year: existing.year,
            status: "skipped_duplicate",
          });
        } else {
          toImport.push(openAlexId);
        }
      } else {
        toImport.push(openAlexId);
      }
    }

    // Nothing to fetch — flush any skip logs and return.
    if (toImport.length === 0) {
      await this.importLogRepo.createMany(logRows);
      return result;
    }

    // Read existing .bib file
    const existing = await this.bibliography.readBibFile(projectId, targetBibPath);
    const existingKeys = new Set(existing.map((e) => e.key));
    const existingByDoi = new Map<string, string>();
    for (const entry of existing) {
      const doi = normalizeDoi(entry.fields.doi);
      if (doi) existingByDoi.set(doi, entry.key);
    }

    // Fetch works with bounded concurrency (previously fully serial awaits).
    const fetched = await mapWithConcurrency(
      toImport,
      OPENALEX_FETCH_CONCURRENCY,
      async (openAlexId) => {
        try {
          const work = await this.apiClient.getWorkById(openAlexId);
          return { openAlexId, ok: true as const, work };
        } catch (error) {
          return {
            openAlexId,
            ok: false as const,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },
    );

    // Process results SEQUENTIALLY in original order so citation-key dedup
    // (which mutates existingKeys) stays deterministic.
    const newEntries: Array<{ entry: ReturnType<typeof mapOpenAlexWorkToBibEntry> }> = [];
    for (const item of fetched) {
      if (!item.ok) {
        logRows.push({
          userId,
          projectId,
          openAlexId: item.openAlexId,
          citationKey: "",
          targetBibPath,
          status: "failed",
          errorMessage: item.error,
        });
        result.failed.push({ openAlexId: item.openAlexId, errorMessage: item.error });
        continue;
      }

      try {
        const work = item.work;
        const entry = mapOpenAlexWorkToBibEntry(work);
        const doi = normalizeDoi(work.doi);
        const existingKey =
          existingImportKeys.get(item.openAlexId) ||
          (doi ? existingByDoi.get(doi) : undefined) ||
          (existingKeys.has(entry.key) ? entry.key : undefined);

        if (existingKey && conflictMode === "skip") {
          result.skippedDuplicate.push({ openAlexId: item.openAlexId, existingKey });
          logRows.push({
            userId,
            projectId,
            openAlexId: item.openAlexId,
            citationKey: existingKey,
            targetBibPath,
            doi: work.doi,
            title: work.title,
            year: work.publication_year,
            status: "skipped_duplicate",
          });
          continue;
        }

        if (existingKey && conflictMode === "replace") {
          entry.key = existingKey;
        } else {
          entry.key = dedupeKey(entry.key, existingKeys);
        }
        existingKeys.add(entry.key);
        if (doi) existingByDoi.set(doi, entry.key);

        newEntries.push({ entry });

        logRows.push({
          userId,
          projectId,
          openAlexId: item.openAlexId,
          citationKey: entry.key,
          targetBibPath,
          doi: work.doi,
          title: work.title,
          year: work.publication_year,
          status: "imported",
        });

        result.imported.push({ openAlexId: item.openAlexId, citationKey: entry.key });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logRows.push({
          userId,
          projectId,
          openAlexId: item.openAlexId,
          citationKey: "",
          targetBibPath,
          status: "failed",
          errorMessage,
        });
        result.failed.push({ openAlexId: item.openAlexId, errorMessage });
      }
    }

    // Write bib first (content is the source of truth), then flush all logs once.
    if (newEntries.length > 0) {
      const merged = this.bibliography.mergeEntries(
        existing,
        newEntries.map(({ entry }) => entry),
      );
      await this.bibliography.writeBibFile(projectId, targetBibPath, merged);
    }
    await this.importLogRepo.createMany(logRows);

    return result;
  }
}
