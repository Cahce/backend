/**
 * CompileQueue port
 * 
 * Port for managing the compile job queue.
 */

export interface CompileQueue {
  /**
   * Enqueue a compile job for processing
   */
  enqueue(jobId: string): Promise<void>;

  /**
   * Start the queue worker (if enabled)
   */
  start(): void;

  /**
   * Stop the queue worker gracefully
   */
  stop(): Promise<void>;

  /**
   * Optional: resolve when the given job NEXT finishes processing (settles to
   * success/failed). Lets callers await completion instead of polling the DB.
   *
   * The promise may never resolve if the job already settled before this was
   * called, or is processed by a different queue instance — so callers MUST
   * race it against a timeout / periodic re-check, never await it alone.
   */
  waitForSettle?(jobId: string): Promise<void>;
}
