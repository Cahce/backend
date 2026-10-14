export interface ShutdownOptions {
  beginDrain(): void;
  close(): Promise<unknown>;
  reportError(error: unknown): void;
  forceExit(): void;
  drainMs: number;
  timeoutMs: number;
}

/** One drain/close sequence even when several signals arrive. */
export function createGracefulShutdown(options: ShutdownOptions): () => Promise<void> {
  let stopping: Promise<void> | undefined;
  return () => stopping ??= (async () => {
    const deadline = setTimeout(() => options.forceExit(), options.timeoutMs);
    deadline.unref();
    try {
      options.beginDrain();
      await new Promise(resolve => setTimeout(resolve, options.drainMs));
      await options.close();
      clearTimeout(deadline);
    } catch (error) {
      options.reportError(error);
      options.forceExit();
      clearTimeout(deadline);
    }
  })();
}
