
import type { ZoteroItem, ZoteroCreator } from "./Types.js";
import type { BibEntry, BibEntryType } from "../../bibliography/domain/BibEntry.js";
import { generateCitationKey } from "../../bibliography/domain/CitationKeyGen.js";

export function mapZoteroItemToBibEntry(item: ZoteroItem): BibEntry {
  const type = mapItemType(item.itemType);

  const authors = extractAuthors(item.creators || []);

  const year = extractYear(item.date);

  const key = generateCitationKey({
    authors: authors.map(a => ({ lastName: a.split(", ")[0] || "Unknown" })),
    year,
    title: item.title,
  });

  const fields = buildFields(item, type, authors, year);

  return {
    key,
    type,
    fields,
  };
}

function mapItemType(itemType: string): BibEntryType {
  const typeMap: Record<string, BibEntryType> = {
    journalArticle: "article",
    book: "book",
    bookSection: "incollection",
    conferencePaper: "inproceedings",
    thesis: "phdthesis",
    report: "techreport",
    webpage: "misc",
    magazineArticle: "article",
    newspaperArticle: "article",
    manuscript: "misc",
    patent: "misc",
    presentation: "misc",
    computerProgram: "misc",
  };

  return typeMap[itemType] || "misc";
}

function extractAuthors(creators: ZoteroCreator[]): string[] {
  return creators
    .filter(c => c.creatorType === "author" || c.creatorType === "editor")
    .map(c => {
      if (c.name) {
        return c.name;
      }
      
      const lastName = c.lastName || "";
      const firstName = c.firstName || "";
      
      if (lastName && firstName) {
        return `${lastName}, ${firstName}`;
      }
      
      return lastName || firstName || "Unknown";
    });
}

function extractYear(date?: string): string | undefined {
  if (!date) {
    return undefined;
  }

  const yearMatch = date.match(/\b(19|20)\d{2}\b/);
  return yearMatch ? yearMatch[0] : undefined;
}

function buildFields(
  item: ZoteroItem,
  type: BibEntryType,
  authors: string[],
  year?: string
): Record<string, string> {
  const fields: Record<string, string> = {};

  if (item.title) {
    fields.title = item.title;
  }

  if (authors.length > 0) {
    fields.author = authors.join(" and ");
  }

  if (year) {
    fields.year = year;
  }

  if (item.DOI) {
    fields.doi = item.DOI;
  }

  if (item.url) {
    fields.url = item.url;
  }

  if (item.abstractNote) {
    fields.abstract = item.abstractNote;
  }

  switch (type) {
    case "article":
      if (item.publicationTitle) {
        fields.journal = item.publicationTitle;
      }
      if (item.volume) {
        fields.volume = item.volume;
      }
      if (item.issue) {
        fields.number = item.issue;
      }
      if (item.pages) {
        fields.pages = item.pages;
      }
      if (item.ISSN) {
        fields.note = `ISSN: ${item.ISSN}`;
      }
      break;

    case "book":
      if (item.publisher) {
        fields.publisher = item.publisher;
      }
      if (item.place) {
        fields.address = item.place;
      }
      if (item.edition) {
        fields.edition = item.edition;
      }
      if (item.ISBN) {
        fields.note = `ISBN: ${item.ISBN}`;
      }
      break;

    case "incollection":
      if (item.publicationTitle) {
        fields.booktitle = item.publicationTitle;
      }
      if (item.publisher) {
        fields.publisher = item.publisher;
      }
      if (item.pages) {
        fields.pages = item.pages;
      }
      break;

    case "inproceedings":
      if (item.proceedingsTitle) {
        fields.booktitle = item.proceedingsTitle;
      } else if (item.conferenceName) {
        fields.booktitle = item.conferenceName;
      }
      if (item.pages) {
        fields.pages = item.pages;
      }
      break;

    case "phdthesis":
    case "mastersthesis":
      if (item.university) {
        fields.publisher = item.university;
      }
      if (item.thesisType) {
        fields.note = item.thesisType;
      }
      break;

    case "techreport":
      if (item.institution) {
        fields.publisher = item.institution;
      }
      if (item.reportNumber) {
        fields.number = item.reportNumber;
      }
      if (item.reportType) {
        fields.note = item.reportType;
      }
      break;

    case "misc":
      if (item.websiteTitle) {
        fields.note = item.websiteTitle;
      }
      break;
  }

  return fields;
}
