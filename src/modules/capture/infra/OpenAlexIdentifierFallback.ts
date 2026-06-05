/**
 * OpenAlex Identifier Fallback
 *
 * Implements the capture `IdentifierFallbackPort` over the OpenAlex API so that
 * DOI / arXiv capture works without a self-hosted translation-server. Depends
 * only on the OpenAlex domain *port* (injected), not its infra.
 */

import type { IdentifierFallbackPort } from "../domain/Ports.js";
import type { CaptureItem } from "../domain/Types.js";
import type { OpenAlexApiPort } from "../../openalex/domain/Ports.js";
import type { OpenAlexWork } from "../../openalex/domain/Types.js";
import { reconstructAbstract } from "../../openalex/domain/Mapping.js";

export class OpenAlexIdentifierFallback implements IdentifierFallbackPort {
  constructor(private readonly openalex: OpenAlexApiPort) {}

  async resolveIdentifier(identifier: string): Promise<CaptureItem | null> {
    const doi = normalizeToDoi(identifier);
    if (!doi) return null;

    let work: OpenAlexWork;
    try {
      work = await this.openalex.getWorkByDoi(doi);
    } catch {
      return null;
    }
    return mapWorkToCaptureItem(work);
  }
}

/**
 * Normalize a user identifier to a bare DOI. Supports DOI (bare / `doi:` /
 * doi.org URL) and new-style arXiv IDs (mapped to their DataCite DOI). Returns
 * null for identifiers OpenAlex-by-DOI can't handle (e.g. ISBN, PMID).
 */
export function normalizeToDoi(raw: string): string | null {
  const s = raw.trim();

  const doiUrl = s.match(/^https?:\/\/(?:dx\.)?doi\.org\/(10\..+)$/i);
  if (doiUrl) return doiUrl[1];

  if (/^doi:\s*10\./i.test(s)) return s.replace(/^doi:\s*/i, "").trim();

  if (/^10\.\d{4,9}\/\S+$/.test(s)) return s;

  // arXiv new-style id: "2301.01234", "arXiv:2301.01234v2", or an abs URL.
  const arxiv =
    s.match(/^(?:arxiv:)?(\d{4}\.\d{4,5})(?:v\d+)?$/i) ??
    s.match(/arxiv\.org\/abs\/(\d{4}\.\d{4,5})/i);
  if (arxiv) return `10.48550/arXiv.${arxiv[1]}`;

  return null;
}

function mapWorkToCaptureItem(work: OpenAlexWork): CaptureItem {
  const creators = (work.authorships ?? [])
    .map((a) => a.author?.display_name ?? "")
    .filter((name) => name.length > 0)
    .map((name) => ({ creatorType: "author", ...splitName(name) }));

  const biblio = work.biblio ?? {};
  const pages =
    biblio.first_page && biblio.last_page
      ? `${biblio.first_page}--${biblio.last_page}`
      : biblio.first_page ?? undefined;

  const doi = work.doi
    ? work.doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    : undefined;

  const abstract = reconstructAbstract(work.abstract_inverted_index);

  return {
    key: "",
    version: 0,
    itemType: mapType(work.type),
    title: work.title ?? work.display_name ?? undefined,
    creators,
    date:
      work.publication_date ??
      (work.publication_year ? String(work.publication_year) : undefined),
    publicationTitle: work.primary_location?.source?.display_name ?? undefined,
    volume: biblio.volume ?? undefined,
    issue: biblio.issue ?? undefined,
    pages,
    DOI: doi,
    url:
      work.primary_location?.landing_page_url ??
      work.open_access?.oa_url ??
      undefined,
    abstractNote: abstract || undefined,
  } as CaptureItem;
}

function splitName(displayName: string): {
  firstName?: string;
  lastName?: string;
} {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { lastName: parts[0] };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function mapType(type?: string): string {
  switch (type) {
    case "book":
      return "book";
    case "book-chapter":
      return "bookSection";
    case "dissertation":
      return "thesis";
    case "preprint":
      return "preprint";
    case "dataset":
      return "dataset";
    case "report":
      return "report";
    default:
      return "journalArticle";
  }
}
