
export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

export interface WithTimeoutOptions<T> {
  onTimeout?: () => T | Promise<T>;
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  opts?: WithTimeoutOptions<T>,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } catch (err) {
    if (err instanceof TimeoutError && opts?.onTimeout) {
      return await opts.onTimeout();
    }
    throw err;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
