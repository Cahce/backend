/**
 * Resolve Reference Use Case
 *
 * Previews the metadata for a URL or identifier via translation-server.
 * Read-only: does NOT write to any project file or library.
 */

import type { TranslationServerPort } from "../domain/Ports.js";
import type { CaptureItem } from "../domain/Types.js";
import { CaptureInvalidInputError } from "../domain/Errors.js";
import { assertPublicHttpUrl } from "../domain/UrlSafety.js";

export interface ResolveReferenceCommand {
  url?: string;
  identifier?: string;
}

export interface ResolveReferenceResult {
  items: CaptureItem[];
}

export class ResolveReference {
  constructor(private readonly translation: TranslationServerPort) {}

  async execute(
    command: ResolveReferenceCommand
  ): Promise<ResolveReferenceResult> {
    const url = command.url?.trim();
    const identifier = command.identifier?.trim();

    const provided = [url, identifier].filter((v) => !!v).length;
    if (provided !== 1) {
      throw new CaptureInvalidInputError(
        "Cần cung cấp đúng một trong: url hoặc identifier"
      );
    }

    const items = url
      ? await this.translation.web(assertPublicHttpUrl(url).toString())
      : await this.translation.search(identifier as string);

    return { items };
  }
}
