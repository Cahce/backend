
import type { CaptureItem } from "./Types.js";

export interface TranslationServerPort {
  web(url: string): Promise<CaptureItem[]>;
  search(identifier: string): Promise<CaptureItem[]>;
}

export interface LibraryWriterPort {
  saveItems(userId: string, items: CaptureItem[]): Promise<{ keys: string[] }>;
}

export interface IdentifierFallbackPort {
  resolveIdentifier(identifier: string): Promise<CaptureItem | null>;
}
