
export interface DiagnosticPosition {
  line: number;
  column: number;
}

export interface DiagnosticRange {
  start: DiagnosticPosition;
  end: DiagnosticPosition;
}

export type DiagnosticSeverity = 'error' | 'warning' | 'hint' | 'info';

export interface CompileDiagnostic {
  severity: DiagnosticSeverity;
  message: string;
  file?: string;
  range?: DiagnosticRange;
  hints?: string[];
}
