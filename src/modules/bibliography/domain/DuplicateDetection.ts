/**
 * Duplicate detection for bibliography entries.
 *
 * Pure domain helper: no file IO, no framework dependencies.
 */

import type { BibEntry, BibEntryType } from "./BibEntry.js";

export type DuplicateMatchReason = "key" | "doi" | "title_author_year";
export type DuplicateEntrySource = "existing" | "candidate";

export interface DuplicateEntrySummary {
  key: string;
  type: BibEntryType;
  title: string | null;
  author: string | null;
  year: string | null;
  doi: string | null;
  index: number;
  source: DuplicateEntrySource;
}

export interface DuplicateGroup {
  groupId: string;
  reasons: DuplicateMatchReason[];
  entries: DuplicateEntrySummary[];
}

export interface AnalyzeDuplicateOptions {
  candidates?: BibEntry[];
  matchBy?: DuplicateMatchReason[];
}

interface IndexedEntry {
  entry: BibEntry;
  index: number;
  source: DuplicateEntrySource;
}

const DEFAULT_MATCH_BY: DuplicateMatchReason[] = [
  "key",
  "doi",
  "title_author_year",
];

export function analyzeDuplicateEntries(
  existing: BibEntry[],
  options: AnalyzeDuplicateOptions = {}
): DuplicateGroup[] {
  const matchBy = options.matchBy?.length ? options.matchBy : DEFAULT_MATCH_BY;
  const indexed: IndexedEntry[] = [
    ...existing.map((entry, index) => ({ entry, index, source: "existing" as const })),
    ...(options.candidates ?? []).map((entry, index) => ({
      entry,
      index,
      source: "candidate" as const,
    })),
  ];

  const disjoint = new DisjointSet(indexed.length);
  const reasonsByRoot = new Map<number, Set<DuplicateMatchReason>>();

  for (const reason of matchBy) {
    const buckets = bucketEntries(indexed, reason);
    for (const bucket of buckets.values()) {
      if (bucket.length < 2) continue;
      const first = bucket[0];
      for (let i = 1; i < bucket.length; i++) {
        disjoint.union(first, bucket[i]);
      }
    }
  }

  for (const reason of matchBy) {
    const buckets = bucketEntries(indexed, reason);
    for (const bucket of buckets.values()) {
      if (bucket.length < 2) continue;
      const root = disjoint.find(bucket[0]);
      const reasons = reasonsByRoot.get(root) ?? new Set<DuplicateMatchReason>();
      reasons.add(reason);
      reasonsByRoot.set(root, reasons);
    }
  }

  const entriesByRoot = new Map<number, IndexedEntry[]>();
  indexed.forEach((item, position) => {
    const root = disjoint.find(position);
    const group = entriesByRoot.get(root) ?? [];
    group.push(item);
    entriesByRoot.set(root, group);
  });

  return Array.from(entriesByRoot.entries())
    .filter(([root, entries]) => entries.length > 1 && reasonsByRoot.has(root))
    .map(([root, entries]) => {
      const reasons = Array.from(reasonsByRoot.get(root) ?? []).sort();
      const summaries = entries
        .sort((a, b) => {
          if (a.source !== b.source) return a.source === "existing" ? -1 : 1;
          return a.index - b.index;
        })
        .map(toSummary);

      return {
        groupId: buildGroupId(reasons, summaries),
        reasons,
        entries: summaries,
      };
    })
    .sort((a, b) => a.groupId.localeCompare(b.groupId));
}

function bucketEntries(
  entries: IndexedEntry[],
  reason: DuplicateMatchReason
): Map<string, number[]> {
  const buckets = new Map<string, number[]>();

  entries.forEach((item, position) => {
    const value = keyForReason(item.entry, reason);
    if (!value) return;
    const bucket = buckets.get(value) ?? [];
    bucket.push(position);
    buckets.set(value, bucket);
  });

  return buckets;
}

function keyForReason(entry: BibEntry, reason: DuplicateMatchReason): string | null {
  if (reason === "key") {
    return entry.key.trim().toLowerCase() || null;
  }

  if (reason === "doi") {
    return normalizeDoi(entry.fields.doi);
  }

  const title = normalizeText(entry.fields.title);
  const author = normalizeAuthor(entry.fields.author);
  const year = normalizeYear(entry.fields.year);
  if (!title || !author || !year) return null;
  return `${title}|${author}|${year}`;
}

export function normalizeDoi(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/, "")
    .replace(/\s+/g, "");
  return normalized || null;
}

function normalizeText(value?: string | null): string | null {
  if (!value) return null;
  const normalized = stripDiacritics(value)
    .replace(/[{}]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return normalized || null;
}

function normalizeAuthor(value?: string | null): string | null {
  const firstAuthorRaw = value?.split(/\s+and\s+/i)[0]?.trim();
  if (!firstAuthorRaw) return null;
  if (firstAuthorRaw.includes(",")) {
    return normalizeText(firstAuthorRaw.split(",")[0] ?? null);
  }
  const firstAuthor = normalizeText(firstAuthorRaw);
  if (!firstAuthor) return null;
  const parts = firstAuthor.split(" ").filter(Boolean);
  return parts.at(-1) ?? null;
}

function normalizeYear(value?: string | null): string | null {
  if (!value) return null;
  return value.match(/\d{4}/)?.[0] ?? null;
}

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function toSummary(item: IndexedEntry): DuplicateEntrySummary {
  return {
    key: item.entry.key,
    type: item.entry.type,
    title: item.entry.fields.title ?? null,
    author: item.entry.fields.author ?? null,
    year: item.entry.fields.year ?? null,
    doi: item.entry.fields.doi ?? null,
    index: item.index,
    source: item.source,
  };
}

function buildGroupId(
  reasons: DuplicateMatchReason[],
  entries: DuplicateEntrySummary[]
): string {
  const reasonPart = reasons.join("+");
  const entryPart = entries
    .map((entry) => `${entry.source}:${entry.index}:${entry.key}`)
    .join("|");
  return `${reasonPart}:${entryPart}`;
}

class DisjointSet {
  private readonly parents: number[];

  constructor(size: number) {
    this.parents = Array.from({ length: size }, (_, index) => index);
  }

  find(index: number): number {
    const parent = this.parents[index];
    if (parent === index) return index;
    const root = this.find(parent);
    this.parents[index] = root;
    return root;
  }

  union(a: number, b: number): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) {
      this.parents[rootB] = rootA;
    }
  }
}
