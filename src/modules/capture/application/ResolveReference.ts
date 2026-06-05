/**
 * Resolve Reference Use Case
 *
 * Previews the metadata for a URL or identifier. Read-only: does NOT write to
 * any project file or library. Identifier resolution falls back to OpenAlex
 * (DOI/arXiv) when the translation-server is unavailable.
 */

import type {
  TranslationServerPort,
  IdentifierFallbackPort,
} from "../domain/Ports.js";
import type { CaptureItem } from "../domain/Types.js";
import { resolveReferenceItems } from "./resolveItems.js";

export interface ResolveReferenceCommand {
  url?: string;
  identifier?: string;
}

export interface ResolveReferenceResult {
  items: CaptureItem[];
}

export class ResolveReference {
  constructor(
    private readonly translation: TranslationServerPort,
    private readonly fallback?: IdentifierFallbackPort | null
  ) {}

  async execute(
    command: ResolveReferenceCommand
  ): Promise<ResolveReferenceResult> {
    const items = await resolveReferenceItems(
      this.translation,
      this.fallback,
      command
    );
    return { items };
  }
}
