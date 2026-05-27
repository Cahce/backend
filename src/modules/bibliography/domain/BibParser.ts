/**
 * BibTeX Parser
 * 
 * Parses BibTeX format string into BibEntry objects.
 * Tolerant parser using state machine approach.
 * 
 * No framework dependencies.
 */

import type { BibEntry, BibEntryType } from "./BibEntry.js";

/**
 * Parse BibTeX format string into bibliography entries
 * 
 * @param text - BibTeX formatted string
 * @returns Array of parsed bibliography entries
 * @throws Error if parsing fails
 */
export function parseBib(text: string): BibEntry[] {
  const entries: BibEntry[] = [];
  const lines = text.split("\n");

  let currentEntry: Partial<BibEntry> | null = null;
  let currentField: string | null = null;
  let currentValue: string = "";
  let braceDepth = 0;
  let inEntry = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines and comments outside entries
    if (!inEntry && (line === "" || line.startsWith("%"))) {
      continue;
    }

    // Entry start: @type{key,
    const entryMatch = line.match(/^@(\w+)\s*\{\s*([^,\s]+)\s*,?\s*$/);
    if (entryMatch) {
      const [, type, key] = entryMatch;
      currentEntry = {
        key: key.trim(),
        type: type.toLowerCase() as BibEntryType,
        fields: {},
      };
      inEntry = true;
      braceDepth = 1;
      continue;
    }

    // Entry end: }
    if (inEntry && line === "}") {
      // Save last field if any
      if (currentEntry && currentField && currentValue) {
        const fields = currentEntry.fields as Record<string, string>;
        fields[currentField] = unescapeFieldValue(currentValue.trim());
      }

      // Add entry to results
      if (currentEntry && currentEntry.key && currentEntry.type) {
        entries.push(currentEntry as BibEntry);
      }

      // Reset state
      currentEntry = null;
      currentField = null;
      currentValue = "";
      braceDepth = 0;
      inEntry = false;
      continue;
    }

    // Field line: key = {value} or key = {value},
    if (inEntry && currentEntry) {
      // Check if this is a new field
      const fieldMatch = line.match(/^(\w+)\s*=\s*\{(.*)$/);
      if (fieldMatch && braceDepth === 1) {
        // Save previous field if any
        if (currentField && currentValue) {
          const fields = currentEntry.fields as Record<string, string>;
          fields[currentField] = unescapeFieldValue(currentValue.trim());
        }

        // Start new field
        const [, fieldName, valueStart] = fieldMatch;
        currentField = fieldName.toLowerCase();
        
        // Check if field value ends on same line
        const closingBraceIndex = valueStart.lastIndexOf("}");
        if (closingBraceIndex !== -1) {
          // Single-line field: extract value between braces
          let fieldValue = valueStart.substring(0, closingBraceIndex);
          // Remove trailing comma if present
          if (fieldValue.endsWith(",")) {
            fieldValue = fieldValue.slice(0, -1);
          }
          currentValue = fieldValue;
          
          // Save field immediately
          const fields = currentEntry.fields as Record<string, string>;
          fields[currentField] = unescapeFieldValue(currentValue.trim());
          currentField = null;
          currentValue = "";
        } else {
          // Multi-line field: start accumulating
          currentValue = valueStart;
        }

        continue;
      }

      // Continuation of multi-line field value
      if (currentField) {
        // Check if this line closes the field
        const closingBraceIndex = line.lastIndexOf("}");
        if (closingBraceIndex !== -1) {
          // Add the part before closing brace
          let finalPart = line.substring(0, closingBraceIndex);
          // Remove trailing comma if present
          if (finalPart.endsWith(",")) {
            finalPart = finalPart.slice(0, -1);
          }
          currentValue += "\n" + finalPart;
          
          // Save field
          const fields = currentEntry.fields as Record<string, string>;
          fields[currentField] = unescapeFieldValue(currentValue.trim());
          currentField = null;
          currentValue = "";
        } else {
          // Continue accumulating
          currentValue += "\n" + line;
        }
      }
    }
  }

  return entries;
}

/**
 * Unescape BibTeX special characters
 */
function unescapeFieldValue(value: string): string {
  return value
    .replace(/\\~\{\}/g, "~")
    .replace(/\\\^\{\}/g, "^")
    .replace(/\\_/g, "_")
    .replace(/\\#/g, "#")
    .replace(/\\&/g, "&")
    .replace(/\\\$/g, "$")
    .replace(/\\%/g, "%")
    .replace(/\\\}/g, "}")
    .replace(/\\\{/g, "{")
    .replace(/\\\\/g, "\\");      // Backslash must be last
}
