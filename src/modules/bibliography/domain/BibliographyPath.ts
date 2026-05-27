/**
 * Bibliography Format Detection
 *
 * Path-based helper to decide whether a project file is a bibliography
 * source, and which format (BibTeX vs Hayagriva YAML). Detection looks at
 * the extension only — it does NOT read the file content. The bibliography
 * module routes parser/serializer based on this result.
 *
 * Why path-based: extending `FileKind` with a new "bibliography" value would
 * require a Prisma migration. `.yml`/`.yaml` files are already stored as
 * `FileKind.Config` and included in Typst's compilation input, so the meaning
 * "this is a bibliography" is purely a path-level concept.
 */

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
