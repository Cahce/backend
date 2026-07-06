
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
      const entryFullPath = join(input.workDir, input.entryPath);
      await readFile(entryFullPath, 'utf-8');

      const fontDir = resolve(config.compile.fontDirs);

      const compiler = NodeCompiler.create({
        workspace: input.workDir,
        fontArgs: [{ fontPaths: [fontDir] }],
      });

      const compilePromise = (async () => {
        const compileResult = compiler.compile({
          mainFilePath: entryFullPath,
        });

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

        const pdfBuffer = compiler.pdf(doc);
        
        await writeFile(input.outputPath, pdfBuffer);

        const warnings = compileResult.takeWarnings();
        const warningDiagnostics = warnings
          ? parseTypstDiagnostics(this.collectDiagnostics(compiler, warnings), input.workDir)
          : [];

        return {
          ok: true,
          diagnostics: warningDiagnostics,
        };
      })();

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

  private collectDiagnostics(compiler: NodeCompiler, nodeError: unknown): unknown[] {
    try {
      const fetched = (
        compiler as unknown as { fetchDiagnostics?: (err: unknown) => unknown }
      ).fetchDiagnostics?.(nodeError);
      if (Array.isArray(fetched)) return fetched;
    } catch {
    }
    const short = (nodeError as { shortDiagnostics?: unknown }).shortDiagnostics;
    return Array.isArray(short) ? short : [];
  }
}
