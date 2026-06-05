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

/**
 * Optional fallback resolver for identifiers (DOI / arXiv) when the
 * translation-server is unavailable or returns nothing. Implemented over the
 * OpenAlex module so DOI/arXiv capture works without a self-hosted
 * translation-server (no Docker required).
 */
export interface IdentifierFallbackPort {
  /** Resolve a DOI/arXiv identifier to an item, or null if it can't. */
  resolveIdentifier(identifier: string): Promise<CaptureItem | null>;
}
