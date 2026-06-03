/**
 * Capture Domain Types
 *
 * The `translation-server` returns Zotero-format item JSON, so a captured
 * reference reuses the Zotero domain item shape. This is a TYPE-ONLY import —
 * no runtime coupling to the zotero module's infra.
 */

import type { ZoteroItem } from "../../zotero/domain/Types.js";

/** A captured reference (Zotero-format item). */
export type CaptureItem = ZoteroItem;

/**
 * How a reference is identified for capture. Exactly one of `url`,
 * `identifier`, or `item` must be provided.
 */
export interface CaptureInput {
  /** A web page URL to extract metadata from (translation-server `/web`). */
  url?: string;
  /** A DOI / PMID / arXiv ID / ISBN (translation-server `/search`). */
  identifier?: string;
  /** An already-resolved item (e.g. from a prior `resolve` preview). */
  item?: CaptureItem;
}
