/**
 * Capture Domain Ports
 *
 * Interfaces for external dependencies. No framework dependencies.
 */

import type { CaptureItem } from "./Types.js";

/**
 * Zotero translation-server port. Converts a web page or identifier into
 * Zotero-format item(s) using Zotero's own translators (self-hosted server).
 */
export interface TranslationServerPort {
  /** POST /web — extract metadata from a web page URL. */
  web(url: string): Promise<CaptureItem[]>;
  /** POST /search — resolve a DOI / PMID / arXiv ID / ISBN. */
  search(identifier: string): Promise<CaptureItem[]>;
}

/**
 * Writes captured items into the user's reference library (Zotero).
 * Implemented by an adapter over the `zotero` module's SaveItemsToLibrary use
 * case, so the capture module does not depend on zotero infra directly.
 */
export interface LibraryWriterPort {
  saveItems(userId: string, items: CaptureItem[]): Promise<{ keys: string[] }>;
}
