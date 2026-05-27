/**
 * Race a promise against a timeout, **always clearing the timer**.
 *
 * The naïve `Promise.race([work, new Promise(r => setTimeout(r, ms))])` pattern
 * leaves the `setTimeout` callback queued in the event loop even when `work`
 * wins. Under load, those orphan timers hold their closure references and
 * accumulate into a real heap leak. Wrapping the timeout in this helper
 * ensures `clearTimeout` runs in the `finally`, so the resource discipline
 * is enforced at one place instead of every caller.
 */

export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

export interface WithTimeoutOptions<T> {
  /**
   * Khi timeout, gọi callback này để trả về giá trị thay vì throw `TimeoutError`.
   * Hữu ích khi caller muốn `Result`-pattern hơn là exception.
   */
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
    // Clear regardless of which side wins. Calling clearTimeout on an
    // already-fired timer is a no-op so this is safe in both paths.
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
