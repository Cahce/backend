
import type { FileRepo } from "../../project-files/domain/ProjectFile/Ports.js";
import { FileKind } from "../../project-files/domain/ProjectFile/Types.js";
import type { BibEntry } from "../domain/BibEntry.js";
import { parseBib } from "../domain/BibParser.js";
import { serializeBib } from "../domain/BibSerializer.js";
import { parseHayagriva } from "../domain/HayagrivaParser.js";
import { serializeHayagriva } from "../domain/HayagrivaSerializer.js";
import { detectBibFormat } from "../domain/BibliographyPath.js";
import { CollaborationError } from '../../projects/domain/access/CollaborationErrors.js';
import { createHash } from 'node:crypto';

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
    entries: BibEntry[],
    actorId?: string,
    incoming: BibEntry[] = entries,
  ): Promise<void> {
    const fmt = detectBibFormat(path);
    if (!fmt) {
      throw new Error(`Unsupported bibliography format: ${path}`);
    }

    const kind = fmt === "bibtex" ? FileKind.Bib : FileKind.Config;
    for (let attempt = 0; attempt < 3; attempt++) {
    const existingFile = await this.fileRepo.findByProjectIdAndPath(projectId, path);
    // Merge only the imported delta into the latest saved source, then compare revisions.
    const current = existingFile?.textContent ? (fmt === 'bibtex' ? parseBib(existingFile.textContent) : parseHayagriva(existingFile.textContent)) : [];
    const merged = this.mergeEntries(current, incoming);
    const content = fmt === 'bibtex' ? serializeBib(merged) : serializeHayagriva(merged);
    const sha256 = createHash('sha256').update(content).digest('hex');
    try {

    if (existingFile) {
      await this.fileRepo.update({
        actorId, fileId: existingFile.id, baseRevision: existingFile.revision ?? 1,
        projectId,
        path,
        content,
        sizeBytes: Buffer.byteLength(content, "utf8"),
        sha256,
      });
    } else {
      await this.fileRepo.create({
        actorId,
        projectId,
        path,
        kind,
        content,
        storageMode: "inline",
        sizeBytes: Buffer.byteLength(content, "utf8"),
        sha256,
      });
    }
    return;
    } catch (error) {
      if (attempt < 2 && ((error instanceof CollaborationError && error.code === 'FILE_VERSION_CONFLICT') ||
        (error instanceof Error && error.message === 'FILE_ALREADY_EXISTS'))) continue;
      throw error;
    }
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
