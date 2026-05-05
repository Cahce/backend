/**
 * NodeTypstCompileService
 * 
 * Uses @myriaddreamin/typst-ts-node-compiler for server-side Typst compilation.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';
import type { TypstCompileService, TypstCompileInput, TypstCompileResult } from '../domain/TypstCompileService.js';
import type { CompileDiagnostic } from '../domain/CompileDiagnostic.js';

export class NodeTypstCompileService implements TypstCompileService {
  async compile(input: TypstCompileInput): Promise<TypstCompileResult> {
    try {
      // Read entry file
      const entryFullPath = join(input.workDir, input.entryPath);
      const mainContent = await readFile(entryFullPath, 'utf-8');

      // Create compiler instance with workspace
      const compiler = NodeCompiler.create({
        workspace: input.workDir,
      });

      // Compile with timeout
      const compilePromise = (async () => {
        const compileResult = compiler.compile({
          mainFileContent: mainContent,
          mainFilePath: input.entryPath,
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

      const timeoutPromise = new Promise<TypstCompileResult>((resolve) => {
        setTimeout(() => resolve({
          ok: false,
          diagnostics: [
            {
              severity: 'error' as const,
              message: 'Compilation timeout exceeded',
            },
          ],
        }), input.timeoutMs);
      });

      return await Promise.race([compilePromise, timeoutPromise]);
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

  private parseDiagnostics(typstDiagnostics: any[], workDir?: string): CompileDiagnostic[] {
    return typstDiagnostics.map((diag) => {
      const diagnostic: CompileDiagnostic = {
        severity: this.mapSeverity(diag.severity),
        message: diag.message || 'Unknown error',
      };

      // Add file and range if available — normalize to project-relative path
      if (diag.span) {
        if (diag.span.path && workDir) {
          const rel = relative(workDir, diag.span.path).replace(/\\/g, '/');
          diagnostic.file = rel.startsWith('..') ? undefined : rel;
        } else if (diag.span.path) {
          diagnostic.file = diag.span.path;
        }
        if (diag.span.start && diag.span.end) {
          diagnostic.range = {
            start: {
              line: diag.span.start.line || 1,
              column: diag.span.start.column || 1,
            },
            end: {
              line: diag.span.end.line || 1,
              column: diag.span.end.column || 1,
            },
          };
        }
      }

      // Add hints if available
      if (diag.hints && Array.isArray(diag.hints)) {
        diagnostic.hints = diag.hints;
      }

      return diagnostic;
    });
  }

  private mapSeverity(severity: string | undefined): 'error' | 'warning' | 'hint' | 'info' {
    switch (severity?.toLowerCase()) {
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
}
