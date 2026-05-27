/**
 * Bibliography Domain - BibEntry Types
 * 
 * Core domain types for bibliography entries.
 * No framework dependencies.
 */

/**
 * Supported BibTeX entry types
 */
export type BibEntryType =
  | "article"
  | "book"
  | "incollection"
  | "inproceedings"
  | "phdthesis"
  | "mastersthesis"
  | "techreport"
  | "misc";

/**
 * BibTeX entry fields
 * All fields are optional as different entry types require different fields
 */
export interface BibEntryFields {
  title?: string;
  author?: string;          // "Last, First and Last, First"
  year?: string;
  journal?: string;
  booktitle?: string;
  volume?: string;
  number?: string;
  pages?: string;
  doi?: string;
  url?: string;
  publisher?: string;
  abstract?: string;
  note?: string;
  editor?: string;
  edition?: string;
  series?: string;
  address?: string;
  month?: string;
  isbn?: string;
  issn?: string;
  keywords?: string;
}

/**
 * Complete bibliography entry
 */
export interface BibEntry {
  key: string;              // Citation key (e.g., "Smith2024Machine")
  type: BibEntryType;
  fields: BibEntryFields;
}
