import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';
import type { TypstCompileInput, TypstCompileResult } from '../domain/TypstCompileService.js';
import { parseTypstDiagnostics } from './diagnosticMapping.js';

export type TypstCompileChildInput = TypstCompileInput & { fontDir: string };

function collectDiagnostics(compiler: NodeCompiler, nodeError: unknown): unknown[] {
  try {
    const fetched = (compiler as unknown as { fetchDiagnostics?: (err: unknown) => unknown }).fetchDiagnostics?.(nodeError);
    if (Array.isArray(fetched)) return fetched;
  } catch { /* Fall back to the native short diagnostic shape. */ }
  const short = (nodeError as { shortDiagnostics?: unknown }).shortDiagnostics;
  return Array.isArray(short) ? short : [];
}

// The synchronous native compiler and PDF renderer must only run in this child.
// The parent owns the deadline and waits for process exit before removing workDir.
process.once('message', async (input: TypstCompileChildInput) => {
  let result: TypstCompileResult;
  try {
    const entryFullPath = join(input.workDir, input.entryPath);
    await readFile(entryFullPath, 'utf-8');
    const compiler = NodeCompiler.create({ workspace: input.workDir, fontArgs: [{ fontPaths: [input.fontDir] }] });
    const compiled = compiler.compile({ mainFilePath: entryFullPath });
    if (compiled.hasError()) {
      const error = compiled.takeError();
      result = { ok: false, diagnostics: error ? parseTypstDiagnostics(collectDiagnostics(compiler, error), input.workDir) : [] };
    } else if (!compiled.result) {
      result = { ok: false, diagnostics: [{ severity: 'error', message: 'Compilation produced no document' }] };
    } else {
      await writeFile(input.outputPath, compiler.pdf(compiled.result));
      const warnings = compiled.takeWarnings();
      result = { ok: true, diagnostics: warnings ? parseTypstDiagnostics(collectDiagnostics(compiler, warnings), input.workDir) : [] };
    }
  } catch {
    result = { ok: false, diagnostics: [{ severity: 'error', message: 'Không thể chạy trình biên dịch Typst' }] };
  }
  if (process.connected) process.send?.(result, () => process.exit(0));
  else process.exit(1);
});
