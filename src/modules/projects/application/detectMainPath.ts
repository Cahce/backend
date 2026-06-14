/**
 * Main-file (entry-point) detection for imported Typst projects.
 *
 * Pure, framework-free logic (no Fastify/Prisma/Zod). Given the set of files in
 * an import, it picks the file that should become `ProjectSettings.mainPath`.
 *
 * Priority chain (see `.kiro/specs/main-file-detection/design.md`):
 *   1. Manifest entry — `typst.toml` `[template] entrypoint` (resolved against
 *      `[template] path`), else a legacy top-level `entry = "…"`.
 *   2. Include/import-graph root — the `.typ` file not included/imported by any
 *      other `.typ` file that transitively reaches the most files.
 *   3. `main.typ` at the project root.
 *   4. First `.typ` file alphabetically (legacy fallback).
 *
 * Note: `[package] entrypoint` (the library import target, e.g. `lib.typ`) is
 * intentionally NOT treated as the document main.
 */

import path from 'node:path';

const TYP_RE = /\.typ$/i;

export interface DetectFile {
  /** Project-relative path, e.g. `90-Document/90-Document.typ`. */
  path: string;
  /** UTF-8 text for `.typ` files; `null` for binary/non-Typst entries. */
  content: string | null;
}

export interface ManifestEntry {
  templatePath: string | null;
  templateEntrypoint: string | null;
  legacyEntry: string | null;
}

export function isTypstSource(filePath: string): boolean {
  return TYP_RE.test(filePath);
}

/** Normalise a candidate path to a safe, project-relative POSIX path. */
function toProjectPath(raw: string): string | null {
  const cleaned = raw.replace(/\\/g, '/').trim();
  if (!cleaned) return null;
  const normalised = path.posix.normalize(cleaned).replace(/^\/+/, '');
  if (!normalised || normalised === '.' || normalised.startsWith('..')) return null;
  return normalised;
}

/**
 * Minimal section-aware TOML scanner — captures `key = "value"` pairs and the
 * section they belong to. Sufficient for reading manifest paths; not a full
 * TOML parser.
 */
function scanToml(toml: string): Array<{ section: string; key: string; value: string }> {
  const rows: Array<{ section: string; key: string; value: string }> = [];
  let section = '';
  for (const rawLine of toml.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const sectionMatch = line.match(/^\[([^\]]+)\]/);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      continue;
    }
    const kvMatch = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*"([^"]*)"/);
    if (kvMatch) {
      rows.push({ section, key: kvMatch[1].trim(), value: kvMatch[2] });
    }
  }
  return rows;
}

export function parseManifestEntry(toml: string | null): ManifestEntry {
  const empty: ManifestEntry = {
    templatePath: null,
    templateEntrypoint: null,
    legacyEntry: null,
  };
  if (!toml) return empty;
  const rows = scanToml(toml);
  const find = (section: string, key: string): string | null =>
    rows.find((row) => row.section === section && row.key === key)?.value ?? null;
  return {
    templatePath: find('template', 'path'),
    templateEntrypoint: find('template', 'entrypoint'),
    // Prefer a top-level `entry`, but accept one in any section as a fallback.
    legacyEntry: find('', 'entry') ?? rows.find((row) => row.key === 'entry')?.value ?? null,
  };
}

function resolveManifestEntry(manifest: ManifestEntry, pathSet: Set<string>): string | null {
  if (manifest.templateEntrypoint) {
    const base = manifest.templatePath ? manifest.templatePath.replace(/\\/g, '/') : '';
    const joined = base ? `${base}/${manifest.templateEntrypoint}` : manifest.templateEntrypoint;
    const resolved = toProjectPath(joined);
    if (resolved && pathSet.has(resolved)) return resolved;
    // Some exports flatten the template dir — try the bare entrypoint too.
    const bare = toProjectPath(manifest.templateEntrypoint);
    if (bare && pathSet.has(bare)) return bare;
  }
  if (manifest.legacyEntry) {
    const resolved = toProjectPath(manifest.legacyEntry);
    if (resolved && pathSet.has(resolved)) return resolved;
  }
  return null;
}

/**
 * Extract local `#include`/`#import` string-literal targets from Typst source.
 * Package specs (`@preview/…`, `@local/…`) and non-string imports are excluded.
 * Best-effort: does not strip commented-out lines.
 */
export function parseTypstDeps(content: string): string[] {
  const targets: string[] = [];
  const re = /#(?:include|import)\s+"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const raw = match[1];
    if (raw.startsWith('@')) continue; // package spec, not a local file
    targets.push(raw);
  }
  return targets;
}

/**
 * Resolve a raw include/import target (relative to `fromPath`, or absolute from
 * the project root) to a member of `pathSet`, or `null` if it escapes the root
 * or does not exist.
 */
export function resolveDep(
  fromPath: string,
  rawTarget: string,
  pathSet: Set<string>,
): string | null {
  const cleaned = rawTarget.replace(/\\/g, '/').trim();
  if (!cleaned || cleaned.startsWith('@')) return null;

  let resolved: string;
  if (cleaned.startsWith('/')) {
    resolved = cleaned.replace(/^\/+/, '');
  } else {
    const dir = path.posix.dirname(fromPath);
    resolved = path.posix.join(dir === '.' ? '' : dir, cleaned);
  }
  resolved = path.posix.normalize(resolved).replace(/^\/+/, '');
  if (!resolved || resolved === '.' || resolved.startsWith('..')) return null;

  if (pathSet.has(resolved)) return resolved;
  if (!TYP_RE.test(resolved) && pathSet.has(`${resolved}.typ`)) return `${resolved}.typ`;
  return null;
}

export interface TypstGraph {
  /** All `.typ` file paths in the project. */
  typPaths: Set<string>;
  /** file path → set of `.typ` files it includes/imports (resolved). */
  edges: Map<string, Set<string>>;
}

/**
 * Build the directed include/import graph among the project's `.typ` files.
 * Edges only point to other `.typ` files; package imports and non-existent
 * targets are dropped.
 */
export function buildTypstGraph(files: DetectFile[]): TypstGraph {
  const typFiles = files.filter((file) => isTypstSource(file.path));
  const allPaths = new Set(files.map((file) => file.path));
  const typPaths = new Set(typFiles.map((file) => file.path));

  const edges = new Map<string, Set<string>>();
  for (const file of typFiles) {
    const resolvedTyp = new Set<string>();
    for (const dep of parseTypstDeps(file.content ?? '')) {
      const resolved = resolveDep(file.path, dep, allPaths);
      if (resolved && typPaths.has(resolved) && resolved !== file.path) {
        resolvedTyp.add(resolved);
      }
    }
    edges.set(file.path, resolvedTyp);
  }
  return { typPaths, edges };
}

/** Set of `.typ` files transitively reachable from `start` (inclusive). */
export function reachableFrom(graph: TypstGraph, start: string): Set<string> {
  const seen = new Set<string>([start]);
  const stack = [start];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const next of graph.edges.get(current) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return seen;
}

/**
 * Pick the document root via include/import-graph analysis: the `.typ` file
 * that no other `.typ` file includes/imports and that transitively reaches the
 * most files. Returns `null` when there is no meaningful root (e.g. all files
 * are mutually independent, or there is a cycle) so the caller can fall back.
 */
export function pickGraphRoot(files: DetectFile[]): string | null {
  const typFiles = files.filter((file) => isTypstSource(file.path));
  if (typFiles.length === 0) return null;
  if (typFiles.length === 1) return typFiles[0].path;

  const graph = buildTypstGraph(files);

  const inDegree = new Map<string, number>();
  for (const typPath of graph.typPaths) inDegree.set(typPath, 0);
  for (const deps of graph.edges.values()) {
    for (const resolved of deps) {
      inDegree.set(resolved, (inDegree.get(resolved) ?? 0) + 1);
    }
  }

  const candidates = [...graph.typPaths].filter(
    (typPath) => (inDegree.get(typPath) ?? 0) === 0,
  );
  if (candidates.length === 0) return null; // cycle or every file is included

  const scored = candidates
    .map((candidate) => ({
      path: candidate,
      reach: reachableFrom(graph, candidate).size,
      outDegree: (graph.edges.get(candidate) ?? new Set()).size,
      depth: candidate.split('/').length,
      isMain: /(^|\/)main\.typ$/i.test(candidate) ? 1 : 0,
    }))
    .sort(
      (a, b) =>
        b.reach - a.reach ||
        b.outDegree - a.outDegree ||
        a.depth - b.depth ||
        b.isMain - a.isMain ||
        a.path.localeCompare(b.path),
    );

  const best = scored[0];
  // Only a candidate that actually pulls in other files is a confident root.
  if (!best || best.reach <= 1) return null;
  return best.path;
}

export function detectMainPath(
  files: DetectFile[],
  tomls: { typstToml?: string | null; projectToml?: string | null },
): string | null {
  const pathSet = new Set(files.map((file) => file.path));

  // 1. Manifest-declared entry (typst.toml preferred, then project.toml).
  for (const toml of [tomls.typstToml, tomls.projectToml]) {
    const entry = resolveManifestEntry(parseManifestEntry(toml ?? null), pathSet);
    if (entry) return entry;
  }

  // 2. Include/import-graph root.
  const graphRoot = pickGraphRoot(files);
  if (graphRoot) return graphRoot;

  // 3. Conventional main.typ at the project root.
  if (pathSet.has('main.typ')) return 'main.typ';

  // 4. First .typ alphabetically (legacy fallback).
  const firstTypst = files
    .map((file) => file.path)
    .filter(isTypstSource)
    .sort((a, b) => a.localeCompare(b))[0];
  return firstTypst ?? null;
}
