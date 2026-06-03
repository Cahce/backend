/**
 * FileKindPolicy — Centralized FileKind logic
 * 
 * Pure functions for FileKind detection, classification, and MIME type mapping.
 * No dependencies on Prisma client or Fastify.
 */

import { FileKind } from './ProjectFile/Types.js';

/**
 * Extension to FileKind mapping table
 */
const EXT_MAP: Record<string, FileKind> = {
  // Typst source
  typ: FileKind.Typst,
  
  // Bibliography
  bib: FileKind.Bib,
  
  // Raster images
  png: FileKind.Image,
  jpg: FileKind.Image,
  jpeg: FileKind.Image,
  gif: FileKind.Image,
  webp: FileKind.Image,
  
  // Vector graphics
  svg: FileKind.Vector,
  
  // Fonts
  ttf: FileKind.Font,
  otf: FileKind.Font,
  woff: FileKind.Font,
  woff2: FileKind.Font,
  
  // Markdown
  md: FileKind.Markdown,
  
  // Configuration files
  toml: FileKind.Config,
  yaml: FileKind.Config,
  yml: FileKind.Config,
  json: FileKind.Config,
  
  // Data files
  csv: FileKind.Data,
  tsv: FileKind.Data,
  xml: FileKind.Data,

  // Citation Style Language (CSL) — XML data consumed by Typst's
  // `#bibliography(style: "x.csl")`. Mapped to Data (not a new enum value) so
  // it counts as a compilation input + stored as text without a Prisma
  // migration. UI detects `.csl` by extension where it needs to treat it
  // specially (citation-style picker).
  csl: FileKind.Data,
  
  // Plain text
  txt: FileKind.Text,
  
  // PDF
  pdf: FileKind.Pdf,
};

/**
 * Detect FileKind from file path based on extension
 * 
 * @param path - File path (e.g., "main.typ", "assets/logo.svg")
 * @returns FileKind enum value, defaults to FileKind.Other if extension not recognized
 */
export function detectKindFromPath(path: string): FileKind {
  const ext = path.toLowerCase().split('.').pop() ?? '';
  return EXT_MAP[ext] ?? FileKind.Other;
}

/**
 * Check if a FileKind represents binary content
 * 
 * Binary kinds should be stored with storageKey (not textContent)
 * and streamed as binary when downloaded.
 * 
 * @param kind - FileKind to check
 * @returns true if kind represents binary content
 */
export function isBinaryKind(kind: FileKind): boolean {
  return (
    kind === FileKind.Image ||
    kind === FileKind.Vector ||
    kind === FileKind.Font ||
    kind === FileKind.Pdf
  );
}

/**
 * Check if a FileKind should be included in Typst compilation pipeline
 * 
 * Files with these kinds are passed to the Typst compiler as input.
 * Excludes markdown, text, and pdf as they are not directly consumed by Typst.
 * 
 * @param kind - FileKind to check
 * @returns true if kind should be included in compilation
 */
export function isCompilationInput(kind: FileKind): boolean {
  return (
    kind === FileKind.Typst ||
    kind === FileKind.Bib ||
    kind === FileKind.Image ||
    kind === FileKind.Vector ||
    kind === FileKind.Font ||
    kind === FileKind.Data ||
    kind === FileKind.Config
  );
}

/**
 * Get array of FileKind values that should be included in compilation
 * 
 * Helper for repository queries that filter by compilation-relevant kinds.
 * 
 * @returns Array of FileKind values for compilation input
 */
export function getCompilationKinds(): FileKind[] {
  return [
    FileKind.Typst,
    FileKind.Bib,
    FileKind.Image,
    FileKind.Vector,
    FileKind.Font,
    FileKind.Data,
    FileKind.Config,
  ];
}

/**
 * Get default MIME type for a FileKind
 * 
 * Used when streaming binary files or when mimeType is not stored in DB.
 * Falls back to extension-based detection when available.
 * 
 * @param kind - FileKind
 * @param ext - Optional file extension for more specific MIME type
 * @returns MIME type string
 */
export function getMimeTypeForKind(kind: FileKind, ext?: string): string {
  switch (kind) {
    case FileKind.Image:
      if (ext === 'png') return 'image/png';
      if (ext === 'gif') return 'image/gif';
      if (ext === 'webp') return 'image/webp';
      return 'image/jpeg';
    
    case FileKind.Vector:
      return 'image/svg+xml';
    
    case FileKind.Font:
      if (ext === 'otf') return 'font/otf';
      if (ext === 'woff') return 'font/woff';
      if (ext === 'woff2') return 'font/woff2';
      return 'font/ttf';
    
    case FileKind.Pdf:
      return 'application/pdf';
    
    case FileKind.Markdown:
      return 'text/markdown; charset=utf-8';
    
    case FileKind.Config:
      if (ext === 'json') return 'application/json';
      if (ext === 'toml') return 'application/toml';
      return 'application/yaml';
    
    case FileKind.Data:
      if (ext === 'csv') return 'text/csv';
      if (ext === 'tsv') return 'text/tab-separated-values';
      if (ext === 'csl') return 'application/vnd.citationstyles.style+xml';
      return 'application/xml';
    
    case FileKind.Typst:
      return 'text/x-typst; charset=utf-8';
    
    case FileKind.Bib:
      return 'application/x-bibtex; charset=utf-8';
    
    case FileKind.Text:
      return 'text/plain; charset=utf-8';
    
    default:
      return 'application/octet-stream';
  }
}

/**
 * Extract file extension from path
 * 
 * @param path - File path
 * @returns Lowercase extension without dot, or empty string if no extension
 */
export function getExtension(path: string): string {
  const parts = path.toLowerCase().split('.');
  // If there's only one part or the last part is empty, there's no extension
  if (parts.length === 1 || parts[parts.length - 1] === '') {
    return '';
  }
  return parts[parts.length - 1];
}
