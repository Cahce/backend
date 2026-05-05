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
      
      // Process next job if available and not stopped
      if (this.queue.length > 0 && !this.stopped) {
        // Use setImmediate to avoid deep recursion
        setImmediate(() => this.processNext());
      }
    }
  }
}
