
export type BibFormat = "bibtex" | "hayagriva";

export function detectBibFormat(path: string): BibFormat | null {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  if (ext === "bib") return "bibtex";
  if (ext === "yml" || ext === "yaml") return "hayagriva";
  return null;
}

export function isBibliographyPath(path: string): boolean {
  return detectBibFormat(path) !== null;
}
