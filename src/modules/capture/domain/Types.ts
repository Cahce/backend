
import type { ZoteroItem } from "../../zotero/domain/Types.js";

export type CaptureItem = ZoteroItem;

export interface CaptureInput {
  url?: string;
  identifier?: string;
  item?: CaptureItem;
}
