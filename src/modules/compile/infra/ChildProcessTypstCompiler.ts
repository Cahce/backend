import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import type { TypstCompileInput, TypstCompileResult, TypstCompileService } from '../domain/TypstCompileService.js';
import type { TypstCompileChildInput } from './TypstCompileChild.js';

const failed = (message: string): TypstCompileResult => ({ ok: false, diagnostics: [{ severity: 'error', message }] });

export interface ChildProcessTypstCompilerOptions {
  fontDir: string;
  /** Injectable entry point for deterministic process lifecycle tests. Never supplied by HTTP. */
  childUrl?: URL;
}

/** One isolated native compiler per job; queue admission controls concurrency. */
export class ChildProcessTypstCompiler implements TypstCompileService {
  private closed = false;
  private readonly children = new Map<ChildProcess, () => void>();
  private readonly pending = new Set<Promise<TypstCompileResult>>();

  constructor(private readonly options: ChildProcessTypstCompilerOptions) {}

  compile(input: TypstCompileInput): Promise<TypstCompileResult> {
    if (this.closed) return Promise.resolve(failed('Trình biên dịch đang dừng'));
    const childUrl = this.options.childUrl ?? new URL(import.meta.url.endsWith('.ts') ? './TypstCompileChild.ts' : './TypstCompileChild.js', import.meta.url);
    let child: ChildProcess;
    try {
      const loaderArgs = childUrl.pathname.endsWith('.ts') ? ['--import', import.meta.resolve('tsx')] : [];
      child = spawn(process.execPath, [...loaderArgs, fileURLToPath(childUrl)], {
        windowsHide: true,
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      });
    } catch {
      return Promise.resolve(failed('Không thể khởi động trình biên dịch Typst'));
    }
    const promise = new Promise<TypstCompileResult>(resolveResult => {
      let result: TypstCompileResult | undefined;
      let terminated = false;
      const terminate = (message: string) => {
        if (terminated) return;
        terminated = true;
        result = failed(message);
        child.kill('SIGKILL');
      };
      this.children.set(child, () => terminate('Biên dịch bị hủy khi máy chủ dừng'));
      const timer = setTimeout(() => terminate('Compilation timeout exceeded'), input.timeoutMs);
      child.on('message', (message: unknown) => {
        if (terminated || !message || typeof message !== 'object') return;
        const candidate = message as Partial<TypstCompileResult>;
        if (typeof candidate.ok === 'boolean' && Array.isArray(candidate.diagnostics)) result = candidate as TypstCompileResult;
      });
      child.once('error', () => terminate('Không thể khởi động trình biên dịch Typst'));
      child.once('close', () => {
        clearTimeout(timer);
        this.children.delete(child);
        resolveResult(result ?? failed('Trình biên dịch Typst kết thúc bất thường'));
      });
      const payload: TypstCompileChildInput = { ...input, fontDir: resolve(this.options.fontDir) };
      try {
        child.send(payload, error => { if (error) terminate('Không thể gửi tác vụ tới trình biên dịch Typst'); });
      } catch {
        terminate('Không thể gửi tác vụ tới trình biên dịch Typst');
      }
    });
    this.pending.add(promise);
    void promise.then(() => this.pending.delete(promise));
    return promise;
  }

  /** Await process exit before the caller removes the work directory or storage closes. */
  async close(): Promise<void> {
    this.closed = true;
    for (const cancel of this.children.values()) cancel();
    await Promise.all(this.pending);
  }
}
