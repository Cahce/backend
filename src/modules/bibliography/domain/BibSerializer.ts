/**
 * BibTeX Serializer
 * 
 * Converts BibEntry objects to BibTeX format string.
 * Handles escaping and formatting according to BibTeX specification.
 * 
 * No framework dependencies.
 */

import type { BibEntry } from "./BibEntry.js";

/**
 * Serialize bibliography entries to BibTeX format
 * 
 * @param entries - Array of bibliography entries
 * @returns BibTeX formatted string
 */
export function serializeBib(entries: BibEntry[]): string {
  return entries.map(serializeEntry).join("\n\n");
}

/**
 * Serialize a single entry to BibTeX format
 */
function serializeEntry(entry: BibEntry): string {
  const lines: string[] = [];

  // Entry header: @type{key,
  lines.push(`@${entry.type}{${entry.key},`);

  // Fields
  const fieldEntries = Object.entries(entry.fields)
    .filter(([_, value]) => value !== undefined && value !== null && value !== "");

  fieldEntries.forEach(([key, value], index) => {
    const isLast = index === fieldEntries.length - 1;
    const escapedValue = escapeFieldValue(value as string);
    const comma = isLast ? "" : ",";
    lines.push(`  ${key} = {${escapedValue}}${comma}`);
  });

  // Closing brace
  lines.push("}");

  return lines.join("\n");
}

/**
 * Escape special characters in field values
 * 
 * BibTeX special characters that need escaping:
 * - Backslash (\)
 * - Braces ({})
 * - Percent (%)
 * - Dollar ($)
 * - Ampersand (&)
 * - Hash (#)
 * - Underscore (_)
 * - Tilde (~)
 * - Caret (^)
 */
function escapeFieldValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")      // Backslash must be first
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
