
import type { FileRepo } from "../../project-files/domain/ProjectFile/Ports.js";
import { FileKind } from "../../project-files/domain/ProjectFile/Types.js";
import type { BibEntry } from "../domain/BibEntry.js";
import { parseBib } from "../domain/BibParser.js";
import { serializeBib } from "../domain/BibSerializer.js";
import { parseHayagriva } from "../domain/HayagrivaParser.js";
import { serializeHayagriva } from "../domain/HayagrivaSerializer.js";
import { detectBibFormat } from "../domain/BibliographyPath.js";

export class BibliographyService {
  constructor(private readonly fileRepo: FileRepo) {}

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

  mergeEntries(existing: BibEntry[], incoming: BibEntry[]): BibEntry[] {
    const entryMap = new Map<string, BibEntry>();
    
    for (const entry of existing) {
      entryMap.set(entry.key, entry);
    }

    for (const entry of incoming) {
      entryMap.set(entry.key, entry);
    }

    return Array.from(entryMap.values());
  }
}
