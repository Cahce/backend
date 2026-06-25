/**
 * Capture To Project Use Case
 *
 * Resolves a reference (URL/identifier/item), then saves it to the project's
 * `.bib` file and/or the user's Zotero library, and returns the citation key
 * so the editor can insert `#cite(<key>)`.
 *
 * Mirrors the dedupe/merge/write flow of `openalex/ImportToBibFile`.
 */

import type {
  TranslationServerPort,
  LibraryWriterPort,
  IdentifierFallbackPort,
} from "../domain/Ports.js";
import type { CaptureItem } from "../domain/Types.js";
import type { BibliographyService } from "../../bibliography/application/BibliographyService.js";
import type { ProjectWriteAccessPolicy } from "../../projects/domain/access/ProjectAccessPolicies.js";
import {
  CaptureInvalidInputError,
  TranslationNoResultError,
} from "../domain/Errors.js";
import { resolveReferenceItems } from "./resolveItems.js";
import { mapZoteroItemToBibEntry } from "../../zotero/domain/Mapping.js";
import { dedupeKey } from "../../bibliography/domain/CitationKeyGen.js";
import { normalizeDoi } from "../../bibliography/domain/DuplicateDetection.js";

export interface CaptureToProjectCommand {
  userId: string;
  projectId: string;
  url?: string;
  identifier?: string;
  item?: CaptureItem;
  targetBibPath: string;
  saveToBib: boolean;
  saveToZotero: boolean;
  conflictMode?: "skip" | "replace" | "rename";
}

export interface CaptureToProjectResult {
  citationKey: string;
  bibSaved: boolean;
  zoteroItemKey: string | null;
  skippedDuplicate: { existingKey: string } | null;
}

export class CaptureToProject {
  constructor(
    private readonly translation: TranslationServerPort,
    private readonly bibliography: BibliographyService,
    private readonly projectAccess: ProjectWriteAccessPolicy,
    private readonly libraryWriter: LibraryWriterPort,
    private readonly fallback?: IdentifierFallbackPort | null
  ) {}

  async execute(
    command: CaptureToProjectCommand
  ): Promise<CaptureToProjectResult> {
    const {
      userId,
      projectId,
      targetBibPath,
      saveToBib,
      saveToZotero,
      conflictMode = "skip",
    } = command;

    await this.projectAccess.requireWriteAccess(projectId, userId);

    if (!saveToBib && !saveToZotero) {
      throw new CaptureInvalidInputError(
        "Phải chọn ít nhất một nơi lưu (.bib hoặc thư viện Zotero)"
      );
    }

    const item = await this.resolveItem(command);
    const entry = mapZoteroItemToBibEntry(item);

    let bibSaved = false;
    let citationKey = entry.key;
    let skippedDuplicate: { existingKey: string } | null = null;

    if (saveToBib) {
      const existing = await this.bibliography.readBibFile(
        projectId,
        targetBibPath
      );
      const existingKeys = new Set(existing.map((e) => e.key));
      const existingByDoi = new Map<string, string>();
      for (const e of existing) {
        const doi = normalizeDoi(e.fields.doi);
        if (doi) existingByDoi.set(doi, e.key);
      }

      const doi = normalizeDoi(entry.fields.doi);
      const duplicateKey =
        (doi ? existingByDoi.get(doi) : undefined) ??
        (existingKeys.has(entry.key) ? entry.key : undefined);

      if (duplicateKey && conflictMode === "skip") {
        skippedDuplicate = { existingKey: duplicateKey };
        citationKey = duplicateKey;
      } else {
        if (duplicateKey && conflictMode === "replace") {
          entry.key = duplicateKey;
        } else {
          entry.key = dedupeKey(entry.key, existingKeys);
        }
        const merged = this.bibliography.mergeEntries(existing, [entry]);
        await this.bibliography.writeBibFile(projectId, targetBibPath, merged);
        bibSaved = true;
        citationKey = entry.key;
      }
    }

    let zoteroItemKey: string | null = null;
    if (saveToZotero) {
      const { keys } = await this.libraryWriter.saveItems(userId, [item]);
      zoteroItemKey = keys[0] ?? null;
    }

    return { citationKey, bibSaved, zoteroItemKey, skippedDuplicate };
  }

  /** Resolve the single capture source into one item. */
  private async resolveItem(
    command: CaptureToProjectCommand
  ): Promise<CaptureItem> {
    if (command.item) {
      return command.item;
    }

    const items = await resolveReferenceItems(this.translation, this.fallback, {
      url: command.url,
      identifier: command.identifier,
    });

    const first = items[0];
    if (!first) {
      throw new TranslationNoResultError();
    }
    return first;
  }
}
