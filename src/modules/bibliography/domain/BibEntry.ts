
export type BibEntryType =
  | "article"
  | "book"
  | "incollection"
  | "inproceedings"
  | "phdthesis"
  | "mastersthesis"
  | "techreport"
  | "misc";

export interface BibEntryFields {
  title?: string;
  author?: string;
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

export interface BibEntry {
  key: string;
  type: BibEntryType;
  fields: BibEntryFields;
}
