/**
 * Diagnostic mapping for @myriaddreamin/typst-ts-node-compiler.
 *
 * Decodes the compiler's RAW diagnostic items into the domain `CompileDiagnostic`
 * wire shape. Kept as a pure module (no compiler/Fastify/Prisma imports) so it is
 * unit-testable in isolation — mirrors `TypstStderrParser.ts`.
 *
 * Verified wire shape for 0.7.x (see
 * `.kiro/specs/compile-diagnostics-severity-fix/`):
 *
 *   {
 *     message: string;
 *     package: string;            // "" for the user's own project files
 *     path: string;               // ABSOLUTE, forward-slashed
 *     severity: number;           // 1 = error, 2 = warning  (NOT a string)
 *     range:                      // null in shortDiagnostics; set by fetchDiagnostics
 *       | null
 *       | { start: { line: number; character: number };   // 0-based, LSP-style
 *           end:   { line: number; character: number } };
 *   }
 *
 * There is no `span`, `hints`, `line`, or `column` key in this version.
 */

import { relative } from 'node:path';
import type {
  CompileDiagnostic,
  DiagnosticSeverity,
} from '../domain/CompileDiagnostic.js';

/**
 * Map the compiler's severity (a numeric `Severity` enum projected by the napi
 * binding) to the domain string union. Never calls a string method on a value
 * that is not narrowed to `string`, so it can never throw
 * `severity?.toLowerCase is not a function`.
 */
export function mapSeverity(severity: unknown): DiagnosticSeverity {
  if (typeof severity === 'number') {
    // typst: Error = 1, Warning = 2. The server compiler emits only these.
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
  return 'error'; // undefined / unexpected → safest default
}

/**
 * Convert raw compiler diagnostics into `CompileDiagnostic[]`.
 *
 * - `path` (absolute, forward-slashed) → project-relative; out-of-workspace
 *   paths are dropped (`file` omitted) so a temp path never leaks to the client.
 * - `range` uses 0-based LSP `{ line, character }` and is converted to the
 *   1-based `{ line, column }` the domain documents. `range` is omitted when the
 *   compiler provides none (`shortDiagnostics` always has `range: null`).
 */
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

    // File: normalize the compiler's absolute path to project-relative.
    if (typeof diag.path === 'string' && diag.path.length > 0) {
      const rel = relative(workDir, diag.path).replace(/\\/g, '/');
      if (rel.length > 0 && !rel.startsWith('..')) {
        diagnostic.file = rel;
      }
    }

    // Range: 0-based { line, character } → 1-based { line, column }.
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

    // Hints: defensive optional read (absent in 0.7.x, harmless if present).
    if (Array.isArray(diag.hints) && diag.hints.length > 0) {
      diagnostic.hints = diag.hints.map((h) => String(h));
    }

    return diagnostic;
  });
}
