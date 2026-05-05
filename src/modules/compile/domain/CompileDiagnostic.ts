/**
 * Compile diagnostic types
 * 
 * Wire format for compile diagnostics. The same shape is used in the domain,
 * persisted in CompileJob.diagnostics (Prisma JSON), and returned by the HTTP
 * route. The frontend wraps it with `source: "server"` and renders it through
 * the same CodeMirror lint pipeline as client-side WASM diagnostics.
 */

// 1-based line/column matching Typst CLI output and frontend expectation.
export interface DiagnosticPosition {
  line: number;
  column: number;
}

export interface DiagnosticRange {
  start: DiagnosticPosition;
  end: DiagnosticPosition;
}

export type DiagnosticSeverity = 'error' | 'warning' | 'hint' | 'info';

/**
 * Wire format for compile diagnostics.
 */
export interface CompileDiagnostic {
  severity: DiagnosticSeverity;
  message: string;
  /** Project-relative path of the offending file. Undefined for global errors
   *  (e.g. "main.typ not found"); the frontend renders these in the Issues
   *  panel without an inline marker. */
  file?: string;
  /** Source span. REQUIRED for the inline squiggle to render. Omit only when
   *  the compiler genuinely has no source location. */
  range?: DiagnosticRange;
  /** typst attaches "help: ..." notes alongside many errors; pass them through. */
  hints?: string[];
}
