/**
 * InProcessCompileQueue
 * 
 * Single-worker FIFO queue for processing compile jobs.
 * Respects COMPILE_WORKER_ENABLED environment variable.
 */

import type { CompileQueue } from '../domain/CompileQueue.js';

export interface ProcessCompileJobHandler {
  execute(jobId: string): Promise<void>;
}

export interface InProcessCompileQueueOptions {
  enabled: boolean;
  log?: {
    info(msg: string): void;
    error(msg: string, error?: any): void;
  };
}

export class InProcessCompileQueue implements CompileQueue {
  private queue: string[] = [];
  private processing = false;
  private stopped = false;
  // jobId -> resolvers waiting for that job to finish processing.
  private readonly settleWaiters = new Map<string, Array<() => void>>();

  constructor(
    private readonly handler: ProcessCompileJobHandler,
    private readonly options: InProcessCompileQueueOptions,
  ) {}

  async enqueue(jobId: string): Promise<void> {
    if (!this.options.enabled) {
      this.options.log?.info(`Compile worker disabled, job ${jobId} queued but not processed`);
      return;
    }

    this.queue.push(jobId);
    this.options.log?.info(`Job ${jobId} enqueued, queue length: ${this.queue.length}`);
    
    // Start processing if not already running
    if (!this.processing && !this.stopped) {
      this.processNext();
    }
  }

  start(): void {
    if (!this.options.enabled) {
      this.options.log?.info('Compile worker is disabled');
      return;
    }

    this.stopped = false;
    this.options.log?.info('Compile worker started');
    
    // Start processing if there are queued jobs
    if (this.queue.length > 0 && !this.processing) {
      this.processNext();
    }
  }

  /**
   * Resolve when `jobId` next finishes processing. Must be raced against a
   * timeout by the caller (a job that already settled, or one never processed
   * by this instance, will never resolve this promise).
   */
  waitForSettle(jobId: string): Promise<void> {
    return new Promise<void>((resolve) => {
      const waiters = this.settleWaiters.get(jobId) ?? [];
      waiters.push(resolve);
      this.settleWaiters.set(jobId, waiters);
    });
  }

  private notifySettled(jobId: string): void {
    const waiters = this.settleWaiters.get(jobId);
    if (waiters) {
      this.settleWaiters.delete(jobId);
      for (const resolve of waiters) {
        resolve();
      }
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.options.log?.info('Compile worker stopping...');
    
    // Wait for current job to finish
    while (this.processing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    
    this.options.log?.info('Compile worker stopped');
  }

  private async processNext(): Promise<void> {
    if (this.stopped || this.processing) {
      return;
    }

    const jobId = this.queue.shift();
    if (!jobId) {
      return;
    }

    this.processing = true;

    try {
      this.options.log?.info(`Processing job ${jobId}...`);
      await this.handler.execute(jobId);
      this.options.log?.info(`Job ${jobId} completed`);
    } catch (error) {
      this.options.log?.error(`Job ${jobId} failed:`, error);
    } finally {
      this.processing = false;

      // Wake anyone awaiting this job's completion (the DB status was written
      // by the handler before it returned).
      this.notifySettled(jobId);

      // Process next job if available and not stopped
      if (this.queue.length > 0 && !this.stopped) {
        // Use setImmediate to avoid deep recursion
        setImmediate(() => this.processNext());
      }
    }
  }
}
