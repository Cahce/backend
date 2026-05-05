/**
 * TypstCompileService port
 * 
 * Port for invoking the Typst compiler.
 */

import type { CompileDiagnostic } from './CompileDiagnostic.js';

export interface TypstCompileInput {
  workDir: string;        // temp dir already populated with project files
  entryPath: string;      // relative to workDir
  outputPath: string;     // absolute, where the PDF should be written
  timeoutMs: number;
}

export interface TypstCompileResult {
  ok: boolean;
  diagnostics: CompileDiagnostic[];
}

export interface TypstCompileService {
  compile(input: TypstCompileInput): Promise<TypstCompileResult>;
}
