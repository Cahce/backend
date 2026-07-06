
import type { BibEntry } from "./BibEntry.js";

export function serializeBib(entries: BibEntry[]): string {
  return entries.map(serializeEntry).join("\n\n");
}

function serializeEntry(entry: BibEntry): string {
  const lines: string[] = [];

  lines.push(`@${entry.type}{${entry.key},`);

  const fieldEntries = Object.entries(entry.fields)
    .filter(([_, value]) => value !== undefined && value !== null && value !== "");

  fieldEntries.forEach(([key, value], index) => {
    const isLast = index === fieldEntries.length - 1;
    const escapedValue = escapeFieldValue(value as string);
    const comma = isLast ? "" : ",";
    lines.push(`  ${key} = {${escapedValue}}${comma}`);
  });

  lines.push("}");

  return lines.join("\n");
}

function escapeFieldValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/&/g, "\\&")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/~/g, "\\~{}")
    .replace(/\^/g, "\\^{}");
}
