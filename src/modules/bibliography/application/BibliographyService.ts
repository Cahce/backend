/**
 * Bibliography Service
 * 
 * Application layer facade for bibliography operations.
 * Coordinates file I/O with parsing/serialization.
 */

import type { FileRepo } from "../../project-files/domain/ProjectFile/Ports.js";
import { FileKind } from "../../project-files/domain/ProjectFile/Types.js";
import type { BibEntry } from "../domain/BibEntry.js";
import { parseBib } from "../domain/BibParser.js";
import { serializeBib } from "../domain/BibSerializer.js";
import { parseHayagriva } from "../domain/HayagrivaParser.js";
import { serializeHayagriva } from "../domain/HayagrivaSerializer.js";
import { detectBibFormat } from "../domain/BibliographyPath.js";

/**
 * Bibliography Service
 * 
 * Provides high-level operations for managing .bib files in projects.
 */
export class BibliographyService {
  constructor(private readonly fileRepo: FileRepo) {}

  /**
   * Read and parse a bibliography file. Routes to the BibTeX or Hayagriva
   * parser based on the file extension (`.bib` vs `.yml`/`.yaml`). Throws
   * for unsupported extensions so callers fail fast instead of silently
   * dropping entries.
   *
   * @param projectId - Project ID
   * @param path - File path (must end with .bib, .yml, or .yaml)
   * @returns Array of parsed bibliography entries (empty if file missing)
   */
  async readBibFile(projectId: string, path: string): Promise<BibEntry[]> {
    const fmt = detectBibFormat(path);
    if (!fmt) {
      throw new Error(`Unsupported bibliography format: ${path}`);
    }

    const file = await this.fileRepo.findByProjectIdAndPath(projectId, path);
    if (!file || !file.textContent) {
      return [];
    }

    try {
      return fmt === "bibtex"
        ? parseBib(file.textContent)
        : parseHayagriva(file.textContent);
    } catch (error) {
      console.error(`Failed to parse ${fmt} file ${path}:`, error);
      return [];
    }
  }

  /**
   * Write bibliography entries to a project file. Format is selected from
   * the path extension; the matching serializer + `FileKind` are used so
   * Typst's compilation pipeline (which already accepts `Bib` and `Config`)
   * picks the file up automatically.
   *
   * @param projectId - Project ID
   * @param path - File path (must end with .bib, .yml, or .yaml)
   * @param entries - Bibliography entries to write
   */
  async writeBibFile(
    projectId: string,
    path: string,
    entries: BibEntry[]
  ): Promise<void> {
    const fmt = detectBibFormat(path);
    if (!fmt) {
      throw new Error(`Unsupported bibliography format: ${path}`);
    }

    const content =
      fmt === "bibtex" ? serializeBib(entries) : serializeHayagriva(entries);
    // FileKind.Bib for .bib (textual BibTeX) — kept distinct so the file
    // tree can render a TeX icon. .yml/.yaml stay as FileKind.Config so we
    // don't add a new enum value (avoids Prisma migration); the compilation
    // pipeline already includes Config inputs.
    const kind = fmt === "bibtex" ? FileKind.Bib : FileKind.Config;

    const existingFile = await this.fileRepo.findByProjectIdAndPath(projectId, path);

    if (existingFile) {
      await this.fileRepo.update({
        projectId,
        path,
        content,
        sizeBytes: Buffer.byteLength(content, "utf8"),
        sha256: "",
      });
    } else {
      await this.fileRepo.create({
        projectId,
        path,
        kind,
        content,
        storageMode: "inline",
        sizeBytes: Buffer.byteLength(content, "utf8"),
        sha256: "",
      });
    }
  }

  /**
   * Merge incoming entries with existing entries
   * 
   * Strategy: Incoming entries with matching keys overwrite existing entries.
   * New entries are appended.
   * 
   * @param existing - Existing bibliography entries
   * @param incoming - Incoming bibliography entries
   * @returns Merged entries
   */
  mergeEntries(existing: BibEntry[], incoming: BibEntry[]): BibEntry[] {
    // Build map of existing entries by key
    const entryMap = new Map<string, BibEntry>();
    
    for (const entry of existing) {
      entryMap.set(entry.key, entry);
    }

    // Overwrite/add incoming entries
    for (const entry of incoming) {
      entryMap.set(entry.key, entry);
    }

    // Return merged entries as array
    return Array.from(entryMap.values());
  }
}
