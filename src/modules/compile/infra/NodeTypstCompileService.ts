/**
 * NodeTypstCompileService
 * 
 * Uses @myriaddreamin/typst-ts-node-compiler for server-side Typst compilation.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';
import { config } from '../../../config/index.js';
import { withTimeout } from '../../../shared/async/withTimeout.js';
import type { TypstCompileService, TypstCompileInput, TypstCompileResult } from '../domain/TypstCompileService.js';
import type { CompileDiagnostic } from '../domain/CompileDiagnostic.js';

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
          const diagnostics = error ? this.parseDiagnostics(error.shortDiagnostics, input.workDir) : [];
          
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
        const warningDiagnostics = warnings ? this.parseDiagnostics(warnings.shortDiagnostics, input.workDir) : [];

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

  private parseDiagnostics(typstDiagnostics: unknown, workDir?: string): CompileDiagnostic[] {
    if (!Array.isArray(typstDiagnostics)) return [];
    return typstDiagnostics.map((diag) => {
      const diagnostic: CompileDiagnostic = {
        severity: this.mapSeverity(diag?.severity),
        message: diag?.message || 'Unknown error',
      };

      // Normalize to a project-relative file path. typst-ts-node-compiler
      // 0.7.x exposes `path` (+ `range`) on each short diagnostic; older
      // builds used a nested `span` — accept either shape.
      const rawPath: string | undefined = diag?.path ?? diag?.span?.path;
      if (rawPath && workDir) {
        const rel = relative(workDir, rawPath).replace(/\\/g, '/');
        diagnostic.file = rel.startsWith('..') ? undefined : rel;
      } else if (rawPath) {
        diagnostic.file = rawPath;
      }

      // `range` may be null (no source location) or carry start/end with
      // line/column. Guard every access so a successful compile is never
      // turned into a failure by a malformed diagnostic.
      const range = diag?.range ?? diag?.span;
      if (range && range.start && range.end) {
        diagnostic.range = {
          start: {
            line: range.start.line ?? 1,
            column: range.start.column ?? 1,
          },
          end: {
            line: range.end.line ?? 1,
            column: range.end.column ?? 1,
          },
        };
      }

      // Add hints if available
      if (diag?.hints && Array.isArray(diag.hints)) {
        diagnostic.hints = diag.hints;
      }

      return diagnostic;
    });
  }

  /**
   * Map a typst-ts diagnostic severity to our union. The compiler reports
   * severity as an LSP-style **number** (1=error, 2=warning, 3=info, 4=hint);
   * a string form is also tolerated. Anything unrecognized degrades to
   * `error` so issues are never silently dropped. Must not throw — a thrown
   * error here previously bubbled up and reported an otherwise-successful
   * compile as failed (HTTP 422).
   */
  private mapSeverity(severity: unknown): 'error' | 'warning' | 'hint' | 'info' {
    if (typeof severity === 'number') {
      switch (severity) {
        case 1:
          return 'error';
        case 2:
          return 'warning';
        case 3:
          return 'info';
        case 4:
          return 'hint';
        default:
          return 'error';
      }
    }
    if (typeof severity === 'string') {
      switch (severity.toLowerCase()) {
        case 'error':
          return 'error';
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
}
