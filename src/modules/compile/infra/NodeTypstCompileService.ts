/**
 * NodeTypstCompileService
 * 
 * Uses @myriaddreamin/typst-ts-node-compiler for server-side Typst compilation.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';
import { config } from '../../../config/index.js';
import { withTimeout } from '../../../shared/async/withTimeout.js';
import type { TypstCompileService, TypstCompileInput, TypstCompileResult } from '../domain/TypstCompileService.js';
import { parseTypstDiagnostics } from './diagnosticMapping.js';

export class NodeTypstCompileService implements TypstCompileService {
  async compile(input: TypstCompileInput): Promise<TypstCompileResult> {
    try {
      // Verify the entry file exists on disk before invoking the compiler so
      // we can produce a clean error rather than relying on typst.ts's less
      // descriptive failure mode. `readFile` is throw-away — typst.ts itself
      // reads the file via the workspace; we no longer pass the content
      // through `mainFileContent` because typst-ts-node-compiler 0.7.x now
      // rejects requests that specify both `mainFileContent` and
      // `mainFilePath` simultaneously ("main file content and path cannot
      // be specified at the same time, with []").
      const entryFullPath = join(input.workDir, input.entryPath);
      await readFile(entryFullPath, 'utf-8');

      // Resolve font directory to an absolute path so NodeCompiler finds it
      // regardless of the process working directory at runtime.
      const fontDir = resolve(config.compile.fontDirs);

      // Create compiler instance with workspace and local font directory.
      // fontArgs is an array of NodeAddFontPaths | NodeAddFontBlobs; here we
      // point it at the project's bundled fonts under backend/var/fonts/.
      const compiler = NodeCompiler.create({
        workspace: input.workDir,
        fontArgs: [{ fontPaths: [fontDir] }],
      });

      // Compile with timeout.
      // typst-ts-node-compiler 0.7.x resolves relative `mainFilePath`
      // against `process.cwd()`, not against the `workspace` option — so
      // a relative `entryPath` ends up referring to the wrong directory
      // and the compiler rejects with "entry file is not in workspace".
      // Always pass the absolute path that we already computed.
      const compilePromise = (async () => {
        const compileResult = compiler.compile({
          mainFilePath: entryFullPath,
        });

        // Check if compilation has errors
        if (compileResult.hasError()) {
          const error = compileResult.takeError();
          const diagnostics = error
            ? parseTypstDiagnostics(this.collectDiagnostics(compiler, error), input.workDir)
            : [];

          return {
            ok: false,
            diagnostics,
          };
        }

        // Get the compiled document
        const doc = compileResult.result;
        if (!doc) {
          return {
            ok: false,
            diagnostics: [
              {
                severity: 'error' as const,
                message: 'Compilation produced no document',
              },
            ],
          };
        }

        // Generate PDF
        const pdfBuffer = compiler.pdf(doc);
        
        // Write PDF to output path
        await writeFile(input.outputPath, pdfBuffer);

        // Check for warnings
        const warnings = compileResult.takeWarnings();
        const warningDiagnostics = warnings
          ? parseTypstDiagnostics(this.collectDiagnostics(compiler, warnings), input.workDir)
          : [];

        return {
          ok: true,
          diagnostics: warningDiagnostics,
        };
      })();

      // Race compile against timeout. `withTimeout` clears the underlying
      // `setTimeout` no matter which side wins, eliminating the orphan-timer
      // leak that the naïve `Promise.race(...)` pattern caused under load.
      return await withTimeout(compilePromise, input.timeoutMs, {
        onTimeout: () => ({
          ok: false,
          diagnostics: [
            {
              severity: 'error' as const,
              message: 'Compilation timeout exceeded',
            },
          ],
        }),
      });
    } catch (error) {
      return {
        ok: false,
        diagnostics: [
          {
            severity: 'error' as const,
            message: error instanceof Error ? error.message : 'Unknown compilation error',
          },
        ],
      };
    }
  }

  /**
   * Collect the richest available raw diagnostics for a compiler error/warning
   * object. `fetchDiagnostics` carries source ranges; `shortDiagnostics` does
   * not (`range: null`). Prefer the former, fall back to the latter if it is
   * missing or throws — so a diagnostics-formatting hiccup never masks a real
   * compile error or fails an otherwise-successful warning-only compile.
   */
  private collectDiagnostics(compiler: NodeCompiler, nodeError: unknown): unknown[] {
    try {
      const fetched = (
        compiler as unknown as { fetchDiagnostics?: (err: unknown) => unknown }
      ).fetchDiagnostics?.(nodeError);
      if (Array.isArray(fetched)) return fetched;
    } catch {
      // fall through to shortDiagnostics
    }
    const short = (nodeError as { shortDiagnostics?: unknown }).shortDiagnostics;
    return Array.isArray(short) ? short : [];
  }
}
