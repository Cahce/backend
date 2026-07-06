
import type {
  TranslationServerPort,
  IdentifierFallbackPort,
} from "../domain/Ports.js";
import type { CaptureItem } from "../domain/Types.js";
import {
  CaptureInvalidInputError,
  TranslationUnavailableError,
  TranslationNoResultError,
} from "../domain/Errors.js";
import { assertPublicHttpUrl } from "../domain/UrlSafety.js";

export async function resolveReferenceItems(
  translation: TranslationServerPort,
  fallback: IdentifierFallbackPort | null | undefined,
  input: { url?: string; identifier?: string }
): Promise<CaptureItem[]> {
  const url = input.url?.trim();
  const identifier = input.identifier?.trim();

  const provided = [url, identifier].filter((v) => !!v).length;
  if (provided !== 1) {
    throw new CaptureInvalidInputError(
      "Cần cung cấp đúng một trong: url hoặc identifier"
    );
  }

  if (url) {
    assertPublicHttpUrl(url);
    return translation.web(url);
  }

  const id = identifier as string;
  try {
    return await translation.search(id);
  } catch (err) {
    if (
      err instanceof TranslationUnavailableError ||
      err instanceof TranslationNoResultError
    ) {
      const item = await tryFallback(fallback, id);
      if (item) return [item];
    }
    throw err;
  }
}

async function tryFallback(
  fallback: IdentifierFallbackPort | null | undefined,
  identifier: string
): Promise<CaptureItem | null> {
  if (!fallback) return null;
  try {
    return await fallback.resolveIdentifier(identifier);
  } catch {
    return null;
  }
}
