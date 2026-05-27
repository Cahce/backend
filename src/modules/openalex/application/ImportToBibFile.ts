/**
 * Import To Bib File Use Case
 * 
 * Imports OpenAlex works to a project's .bib file.
 * Tracks import history to prevent duplicates.
 */

import type { OpenAlexApiPort, OpenAlexImportLogRepo } from "../domain/Ports.js";
import type { BibliographyService } from "../../bibliography/application/BibliographyService.js";
import type { ProjectAccessPolicy } from "../../compile/domain/Policies.js";
import { mapOpenAlexWorkToBibEntry } from "../domain/Mapping.js";
import { dedupeKey } from "../../bibliography/domain/CitationKeyGen.js";

/**
 * Command to import works to .bib file
 */
export interface ImportToBibFileCommand {
  userId: string;
  projectId: string;
  openAlexIds: string[];
  targetBibPath: string;
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
    private readonly projectAccess: ProjectAccessPolicy,
    private readonly importLogRepo: OpenAlexImportLogRepo
  ) {}

  async execute(command: ImportToBibFileCommand): Promise<ImportToBibFileResult> {
    const { userId, projectId, openAlexIds, targetBibPath } = command;

    // Verify project access
    await this.projectAccess.requireProjectAccess(projectId, userId);

    const result: ImportToBibFileResult = {
      imported: [],
      skippedDuplicate: [],
      failed: [],
    };

    // Check for duplicates first
    const toImport: string[] = [];
    for (const openAlexId of openAlexIds) {
      const existing = await this.importLogRepo.findByProjectAndOpenAlexId(projectId, openAlexId);
      if (existing) {
        result.skippedDuplicate.push({
          openAlexId,
          existingKey: existing.citationKey,
        });
        
        // Log the skip
        await this.importLogRepo.create({
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
    }

    // If nothing to import, return early
    if (toImport.length === 0) {
      return result;
    }

    // Read existing .bib file
    const existing = await this.bibliography.readBibFile(projectId, targetBibPath);
    const existingKeys = new Set(existing.map(e => e.key));

    // Fetch and process works
    const newEntries = [];
    for (const openAlexId of toImport) {
      try {
        const work = await this.apiClient.getWorkById(openAlexId);
        const entry = mapOpenAlexWorkToBibEntry(work);
        
        // Dedupe citation key
        entry.key = dedupeKey(entry.key, existingKeys);
        existingKeys.add(entry.key);
        
        newEntries.push({ work, entry });
        
        // Log successful import
        await this.importLogRepo.create({
          userId,
          projectId,
          openAlexId,
          citationKey: entry.key,
          targetBibPath,
          doi: work.doi,
          title: work.title,
          year: work.publication_year,
          status: "imported",
        });
        
        result.imported.push({
          openAlexId,
          citationKey: entry.key,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        
        // Log failed import
        await this.importLogRepo.create({
          userId,
          projectId,
          openAlexId,
          citationKey: "",
          targetBibPath,
          status: "failed",
          errorMessage,
        });
        
        result.failed.push({
          openAlexId,
          errorMessage,
        });
      }
    }

    // If we have new entries, write to file
    if (newEntries.length > 0) {
      const merged = this.bibliography.mergeEntries(
        existing,
        newEntries.map(({ entry }) => entry)
      );
      await this.bibliography.writeBibFile(projectId, targetBibPath, merged);
    }

    return result;
  }
}
