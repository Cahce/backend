/**
 * Hayagriva YAML Parser
 *
 * Reverse of HayagrivaSerializer — reads a Hayagriva YAML document and
 * produces BibEntry domain objects so the rest of the bibliography
 * pipeline (merge / dedupe / write) is format-agnostic.
 *
 * Tolerant by design: malformed top-level entries are skipped with a
 * console.warn (mirroring BibParser's behaviour). Returning a clean array
 * keeps Zotero/OpenAlex sync robust against hand-edited bibliographies.
 *
 * Schema reference: hayagriva@0.9.1 (vendored by tinymist@references —
 * see references/tinymist/crates/tinymist-query/src/analysis/bib.rs for the
 * authoritative shape).
 */

import { parse as parseYaml } from "yaml";
import type { BibEntry, BibEntryType, BibEntryFields } from "./BibEntry.js";

export function parseHayagriva(text: string): BibEntry[] {
  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (err) {
    console.warn("[hayagriva] YAML parse failed:", err);
    return [];
  }

  if (!isRecord(raw)) return [];

  const entries: BibEntry[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (!isRecord(value)) continue;
    try {
      entries.push(mapToBibEntry(key, value));
    } catch (err) {
      console.warn(`[hayagriva] skipping malformed entry "${key}":`, err);
    }
  }
  return entries;
}

function mapToBibEntry(key: string, h: Record<string, unknown>): BibEntry {
  const parent = isRecord(h.parent) ? h.parent : null;
  const type = reverseType(asString(h.type), parent);
  const fields: BibEntryFields = {};

  if (typeof h.title === "string") fields.title = h.title;

  // author / editor: Hayagriva uses a list, BibTeX joins with " and "
  const author = joinPeople(h.author);
  if (author) fields.author = author;
  const editor = joinPeople(h.editor);
  if (editor) fields.editor = editor;

  // date: number (year) or "YYYY[-MM[-DD]]"
  const dateInfo = parseDate(h.date);
  if (dateInfo.year) fields.year = dateInfo.year;
  if (dateInfo.month) fields.month = dateInfo.month;

  // serial-number → doi/isbn/issn
  const serial = isRecord(h["serial-number"]) ? h["serial-number"] : null;
  if (serial) {
    if (typeof serial.doi === "string") fields.doi = serial.doi;
    if (typeof serial.isbn === "string") fields.isbn = serial.isbn;
    if (typeof serial.issn === "string") fields.issn = serial.issn;
  }

  // page-range
  if (typeof h["page-range"] === "string") fields.pages = h["page-range"];
  else if (typeof h["page-range"] === "number") fields.pages = String(h["page-range"]);

  // publisher / location / edition
  if (typeof h.publisher === "string") fields.publisher = h.publisher;
  if (typeof h.location === "string") fields.address = h.location;
  if (h.edition !== undefined && h.edition !== null) {
    fields.edition = String(h.edition);
  }

  // url
  if (typeof h.url === "string") {
    fields.url = h.url;
  } else if (isRecord(h.url) && typeof h.url.value === "string") {
    fields.url = h.url.value;
  }

  // abstract / note / keywords / series
  if (typeof h.abstract === "string") fields.abstract = h.abstract;
  if (typeof h.note === "string") fields.note = h.note;
  if (typeof h.keywords === "string") fields.keywords = h.keywords;
  if (typeof h.series === "string") fields.series = h.series;

  // parent unwrap: journal / booktitle + volume + issue
  if (parent) {
    const parentTitle = asString(parent.title);
    const parentType = asString(parent.type);
    if (parentTitle) {
      if (parentType === "periodical") fields.journal = parentTitle;
      else fields.booktitle = parentTitle;
    }
    const volume = parent.volume;
    if (volume !== undefined && volume !== null) fields.volume = String(volume);
    const issue = parent.issue;
    if (issue !== undefined && issue !== null) fields.number = String(issue);
  }

  return { key, type, fields };
}

/**
 * Map Hayagriva `type` (+ optional parent.type) back to BibEntryType.
 * Has to look at the parent so a `type: article` with parent
 * `type: proceedings` round-trips to `inproceedings`.
 */
function reverseType(
  hType: string | undefined,
  parent: Record<string, unknown> | null,
): BibEntryType {
  const parentType = parent ? asString(parent.type) : undefined;
  switch (hType) {
    case "article":
      if (parentType === "proceedings") return "inproceedings";
      return "article";
    case "book":
      return "book";
    case "chapter":
      return "incollection";
    case "thesis":
      return "phdthesis";
    case "report":
      return "techreport";
    case "misc":
    case undefined:
      return "misc";
    default:
      return "misc";
  }
}

function joinPeople(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return null;
  const names = value
    .map((v) => {
      if (typeof v === "string") return v;
      if (isRecord(v)) {
        const given = asString(v["given-name"]) ?? asString(v.given);
        const family = asString(v.name) ?? asString(v.family);
        if (family && given) return `${family}, ${given}`;
        return family ?? given ?? null;
      }
      return null;
    })
    .filter((s): s is string => !!s && s.trim() !== "");
  return names.length > 0 ? names.join(" and ") : null;
}

function parseDate(value: unknown): { year?: string; month?: string } {
  if (value === undefined || value === null) return {};
  if (typeof value === "number") {
    return { year: String(value) };
  }
  if (typeof value !== "string") return {};
  // Match YYYY, YYYY-MM, YYYY-MM-DD
  const m = value.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/);
  if (m) {
    return { year: m[1], month: m[2] ? String(parseInt(m[2], 10)) : undefined };
  }
  // Fallback: any 4-digit run
  const fallback = value.match(/(\d{4})/);
  return fallback ? { year: fallback[1] } : {};
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
