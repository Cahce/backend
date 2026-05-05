/**
 * TypstStderrParser
 *
 * Pure function to parse Typst CLI stderr output into CompileDiagnostic[].
 * Supports --diagnostic-format=short format.
 *
 * NOTE: Not used in production. Production compilation uses NodeCompiler from
 * @myriaddreamin/typst-ts-node-compiler (programmatic API) which returns
 * structured diagnostics directly. This parser exists for a potential
 * CLI-spawn fallback and is tested in isolation.
 */

import { relative } from 'node:path';
import type { CompileDiagnostic, DiagnosticSeverity } from '../domain/CompileDiagnostic.js';

// Regex for short format: /path/to/file.typ:12:14: error: message
const SHORT_LINE_RE = /^(.+?):(\d+):(\d+):\s*(error|warning|hint|info):\s*(.+)$/;

/**
 * Parse Typst stderr output into diagnostics
 * 
 * @param stderr - Raw stderr output from typst compile
 * @param workDir - Working directory to make paths relative
 * @returns Array of parsed diagnostics
 */
export function parseTypstStderr(stderr: string, workDir: string): CompileDiagnostic[] {
  const diagnostics: CompileDiagnostic[] = [];
  let pending: CompileDiagnostic | null = null;

  // Strip ANSI color codes
  const cleanStderr = stderr.replace(/\x1b\[[0-9;]*m/g, '');

  for (const rawLine of cleanStderr.split(/\r?\n/)) {
    const line = rawLine.trim();
    
    // Try to match short format
    const match = SHORT_LINE_RE.exec(line);
    if (match) {
      // Save previous diagnostic if any
      if (pending) {
        diagnostics.push(pending);
      }

      const [, absFile, lineNum, colNum, severity, message] = match;
      
      // Make path relative to workDir
      let file: string | undefined;
      try {
        const relPath = relative(workDir, absFile).replace(/\\/g, '/');
        // Only include file if it's within workDir (doesn't start with ..)
        file = relPath.startsWith('..') ? undefined : relPath;
      } catch {
        file = undefined;
      }

      pending = {
        severity: severity as DiagnosticSeverity,
        message,
        file,
        range: {
          start: { line: Number(lineNum), column: Number(colNum) },
          // typst short format gives a point, not a range
          // Frontend will widen empty spans to one character
          end: { line: Number(lineNum), column: Number(colNum) },
        },
        hints: [],
      };
    } else if (pending && line.startsWith('= help:')) {
      // Accumulate help hints
      const hint = line.replace(/^=\s*help:\s*/, '');
      if (hint) {
        pending.hints!.push(hint);
      }
    }
  }

  // Don't forget the last diagnostic
  if (pending) {
    diagnostics.push(pending);
  }

  return diagnostics;
}
