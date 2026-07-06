
import type { BibEntry, BibEntryType } from "./BibEntry.js";

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

    if (!inEntry && (line === "" || line.startsWith("%"))) {
      continue;
    }

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

    if (inEntry && line === "}") {
      if (currentEntry && currentField && currentValue) {
        const fields = currentEntry.fields as Record<string, string>;
        fields[currentField] = unescapeFieldValue(currentValue.trim());
      }

      if (currentEntry && currentEntry.key && currentEntry.type) {
        entries.push(currentEntry as BibEntry);
      }

      currentEntry = null;
      currentField = null;
      currentValue = "";
      braceDepth = 0;
      inEntry = false;
      continue;
    }

    if (inEntry && currentEntry) {
      const fieldMatch = line.match(/^(\w+)\s*=\s*\{(.*)$/);
      if (fieldMatch && braceDepth === 1) {
        if (currentField && currentValue) {
          const fields = currentEntry.fields as Record<string, string>;
          fields[currentField] = unescapeFieldValue(currentValue.trim());
        }

        const [, fieldName, valueStart] = fieldMatch;
        currentField = fieldName.toLowerCase();
        
        const closingBraceIndex = valueStart.lastIndexOf("}");
        if (closingBraceIndex !== -1) {
          let fieldValue = valueStart.substring(0, closingBraceIndex);
          if (fieldValue.endsWith(",")) {
            fieldValue = fieldValue.slice(0, -1);
          }
          currentValue = fieldValue;
          
          const fields = currentEntry.fields as Record<string, string>;
          fields[currentField] = unescapeFieldValue(currentValue.trim());
          currentField = null;
          currentValue = "";
        } else {
          currentValue = valueStart;
        }

        continue;
      }

      if (currentField) {
        const closingBraceIndex = line.lastIndexOf("}");
        if (closingBraceIndex !== -1) {
          let finalPart = line.substring(0, closingBraceIndex);
          if (finalPart.endsWith(",")) {
            finalPart = finalPart.slice(0, -1);
          }
          currentValue += "\n" + finalPart;
          
          const fields = currentEntry.fields as Record<string, string>;
          fields[currentField] = unescapeFieldValue(currentValue.trim());
          currentField = null;
          currentValue = "";
        } else {
          currentValue += "\n" + line;
        }
      }
    }
  }

  return entries;
}

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
    .replace(/\\\\/g, "\\");
}
