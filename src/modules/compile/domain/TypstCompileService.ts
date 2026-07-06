
import type { CompileDiagnostic } from './CompileDiagnostic.js';

export interface TypstCompileInput {
  workDir: string;
  entryPath: string;
  outputPath: string;
  timeoutMs: number;
}

export interface TypstCompileResult {
  ok: boolean;
  diagnostics: CompileDiagnostic[];
}

export interface TypstCompileService {
  compile(input: TypstCompileInput): Promise<TypstCompileResult>;
}
