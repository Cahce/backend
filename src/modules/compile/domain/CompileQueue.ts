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
}
