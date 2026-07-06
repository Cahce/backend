
import { relative } from 'node:path';
import type { CompileDiagnostic, DiagnosticSeverity } from '../domain/CompileDiagnostic.js';

const SHORT_LINE_RE = /^(.+?):(\d+):(\d+):\s*(error|warning|hint|info):\s*(.+)$/;

export function parseTypstStderr(stderr: string, workDir: string): CompileDiagnostic[] {
  const diagnostics: CompileDiagnostic[] = [];
  let pending: CompileDiagnostic | null = null;

  const cleanStderr = stderr.replace(/\x1b\[[0-9;]*m/g, '');

  for (const rawLine of cleanStderr.split(/\r?\n/)) {
    const line = rawLine.trim();
    
    const match = SHORT_LINE_RE.exec(line);
    if (match) {
      if (pending) {
        diagnostics.push(pending);
      }

      const [, absFile, lineNum, colNum, severity, message] = match;
      
      let file: string | undefined;
      try {
        const relPath = relative(workDir, absFile).replace(/\\/g, '/');
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
          end: { line: Number(lineNum), column: Number(colNum) },
        },
        hints: [],
      };
    } else if (pending && line.startsWith('= help:')) {
      const hint = line.replace(/^=\s*help:\s*/, '');
      if (hint) {
        pending.hints!.push(hint);
      }
    }
  }

  if (pending) {
    diagnostics.push(pending);
  }

  return diagnostics;
}
