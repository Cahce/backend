
import { relative } from 'node:path';
import type {
  CompileDiagnostic,
  DiagnosticSeverity,
} from '../domain/CompileDiagnostic.js';

export function mapSeverity(severity: unknown): DiagnosticSeverity {
  if (typeof severity === 'number') {
    return severity === 2 ? 'warning' : 'error';
  }
  if (typeof severity === 'string') {
    switch (severity.toLowerCase()) {
      case 'warning':
        return 'warning';
      case 'hint':
        return 'hint';
      case 'info':
        return 'info';
      default:
        return 'error';
    }
  }
  return 'error';
}

export function parseTypstDiagnostics(
  rawDiagnostics: unknown[],
  workDir: string,
): CompileDiagnostic[] {
  if (!Array.isArray(rawDiagnostics)) return [];

  return rawDiagnostics.map((raw): CompileDiagnostic => {
    const diag = raw as {
      message?: unknown;
      path?: unknown;
      severity?: unknown;
      range?: {
        start?: { line?: number; character?: number };
        end?: { line?: number; character?: number };
      } | null;
      hints?: unknown;
    };

    const diagnostic: CompileDiagnostic = {
      severity: mapSeverity(diag.severity),
      message: typeof diag.message === 'string' ? diag.message : 'Unknown error',
    };

    if (typeof diag.path === 'string' && diag.path.length > 0) {
      const rel = relative(workDir, diag.path).replace(/\\/g, '/');
      if (rel.length > 0 && !rel.startsWith('..')) {
        diagnostic.file = rel;
      }
    }

    if (diag.range && diag.range.start && diag.range.end) {
      diagnostic.range = {
        start: {
          line: (diag.range.start.line ?? 0) + 1,
          column: (diag.range.start.character ?? 0) + 1,
        },
        end: {
          line: (diag.range.end.line ?? 0) + 1,
          column: (diag.range.end.character ?? 0) + 1,
        },
      };
    }

    if (Array.isArray(diag.hints) && diag.hints.length > 0) {
      diagnostic.hints = diag.hints.map((h) => String(h));
    }

    return diagnostic;
  });
}
