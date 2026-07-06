
import { FileKind } from './ProjectFile/Types.js';

const EXT_MAP: Record<string, FileKind> = {
  typ: FileKind.Typst,
  
  bib: FileKind.Bib,
  
  png: FileKind.Image,
  jpg: FileKind.Image,
  jpeg: FileKind.Image,
  gif: FileKind.Image,
  webp: FileKind.Image,
  
  svg: FileKind.Vector,
  
  ttf: FileKind.Font,
  otf: FileKind.Font,
  woff: FileKind.Font,
  woff2: FileKind.Font,
  
  md: FileKind.Markdown,
  
  toml: FileKind.Config,
  yaml: FileKind.Config,
  yml: FileKind.Config,
  json: FileKind.Config,
  
  csv: FileKind.Data,
  tsv: FileKind.Data,
  xml: FileKind.Data,

  csl: FileKind.Data,
  
  txt: FileKind.Text,
  
  pdf: FileKind.Pdf,
};

export function detectKindFromPath(path: string): FileKind {
  const ext = path.toLowerCase().split('.').pop() ?? '';
  return EXT_MAP[ext] ?? FileKind.Other;
}

export function isBinaryKind(kind: FileKind): boolean {
  return (
    kind === FileKind.Image ||
    kind === FileKind.Vector ||
    kind === FileKind.Font ||
    kind === FileKind.Pdf
  );
}

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

export function getExtension(path: string): string {
  const parts = path.toLowerCase().split('.');
  if (parts.length === 1 || parts[parts.length - 1] === '') {
    return '';
  }
  return parts[parts.length - 1];
}
