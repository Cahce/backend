/**
 * OpenAlex to BibEntry Mapping
 * 
 * Maps OpenAlex works to BibTeX entries.
 * No framework dependencies.
 */

import type { OpenAlexWork } from "./Types.js";
import type { BibEntry, BibEntryType } from "../../bibliography/domain/BibEntry.js";
import { generateCitationKey } from "../../bibliography/domain/CitationKeyGen.js";

/**
 * Map OpenAlex work to BibEntry
 */
export function mapOpenAlexWorkToBibEntry(work: OpenAlexWork): BibEntry {
  // Map work type
  const type = mapWorkType(work.type);

  // Extract authors
  const authors = extractAuthors(work);

  // Extract year
  const year = work.publication_year?.toString();

  // Generate citation key
  const key = generateCitationKey({
    authors: authors.map(a => ({ lastName: a.split(", ")[0] || "Unknown" })),
    year,
    title: work.title || work.display_name,
  });

  // Build fields
  const fields = buildFields(work, type, authors, year);

  return {
    key,
    type,
    fields,
  };
}

/**
 * Reconstruct abstract from inverted index
 * 
 * OpenAlex stores abstracts as inverted index: { "word": [position1, position2, ...] }
 * We need to reconstruct the original text.
 */
export function reconstructAbstract(invertedIndex: Record<string, number[]> | undefined): string | undefined {
  if (!invertedIndex) {
    return undefined;
  }

  // Find max position to determine array size
  let maxPosition = 0;
  for (const positions of Object.values(invertedIndex)) {
    for (const pos of positions) {
      if (pos > maxPosition) {
        maxPosition = pos;
      }
    }
  }

  // Create array and fill with words
  const words: string[] = new Array(maxPosition + 1);
  
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = word;
    }
  }

  // Join words with spaces
  return words.filter(w => w !== undefined).join(" ");
}

/**
 * Map OpenAlex work type to BibTeX entry type
 */
function mapWorkType(type?: string): BibEntryType {
  const typeMap: Record<string, BibEntryType> = {
    "journal-article": "article",
    "book": "book",
    "book-chapter": "incollection",
    "proceedings-article": "inproceedings",
    "dissertation": "phdthesis",
    "report": "techreport",
    "dataset": "misc",
    "preprint": "misc",
    "other": "misc",
  };

  return typeMap[type || ""] || "misc";
}

/**
 * Extract and format authors from OpenAlex authorships
 */
function extractAuthors(work: OpenAlexWork): string[] {
  if (!work.authorships || work.authorships.length === 0) {
    return [];
  }

  // Sort by author position
  const sorted = [...work.authorships].sort((a, b) => {
    const posOrder: Record<string, number> = { first: 0, middle: 1, last: 2 };
    return (posOrder[a.author_position] || 1) - (posOrder[b.author_position] || 1);
  });

  return sorted.map(authorship => {
    const name = authorship.author.display_name;
    
    // Try to split into last name and first name
    const parts = name.split(" ");
    if (parts.length >= 2) {
      const lastName = parts[parts.length - 1];
      const firstName = parts.slice(0, -1).join(" ");
      return `${lastName}, ${firstName}`;
    }
    
    return name;
  });
}

/**
 * Build BibTeX fields based on work type
 */
function buildFields(
  work: OpenAlexWork,
  type: BibEntryType,
  authors: string[],
  year?: string
): Record<string, string> {
  const fields: Record<string, string> = {};

  // Common fields
  if (work.title || work.display_name) {
    fields.title = work.title || work.display_name || "";
  }

  if (authors.length > 0) {
    fields.author = authors.join(" and ");
  }

  if (year) {
    fields.year = year;
  }

  // DOI (strip https://doi.org/ prefix if present)
  if (work.doi) {
    fields.doi = work.doi.replace("https://doi.org/", "");
  }

  // URL
  const url = work.open_access?.oa_url || work.primary_location?.landing_page_url;
  if (url) {
    fields.url = url;
  }

  // Abstract
  const abstract = reconstructAbstract(work.abstract_inverted_index);
  if (abstract) {
    fields.abstract = abstract;
  }

  // Type-specific fields
  switch (type) {
    case "article":
      if (work.primary_location?.source?.display_name) {
        fields.journal = work.primary_location.source.display_name;
      }
      if (work.biblio?.volume) {
        fields.volume = work.biblio.volume;
      }
      if (work.biblio?.issue) {
        fields.number = work.biblio.issue;
      }
      if (work.biblio?.first_page && work.biblio?.last_page) {
        fields.pages = `${work.biblio.first_page}--${work.biblio.last_page}`;
      } else if (work.biblio?.first_page) {
        fields.pages = work.biblio.first_page;
      }
      break;

    case "book":
      if (work.primary_location?.source?.host_organization_name) {
        fields.publisher = work.primary_location.source.host_organization_name;
      }
      break;

    case "incollection":
      if (work.primary_location?.source?.display_name) {
        fields.booktitle = work.primary_location.source.display_name;
      }
      if (work.primary_location?.source?.host_organization_name) {
        fields.publisher = work.primary_location.source.host_organization_name;
      }
      break;

    case "inproceedings":
      if (work.primary_location?.source?.display_name) {
        fields.booktitle = work.primary_location.source.display_name;
      }
      break;

    case "phdthesis":
      if (work.primary_location?.source?.host_organization_name) {
        fields.publisher = work.primary_location.source.host_organization_name;
      }
      break;

    case "techreport":
      if (work.primary_location?.source?.host_organization_name) {
        fields.publisher = work.primary_location.source.host_organization_name;
      }
      break;
  }

  return fields;
}
