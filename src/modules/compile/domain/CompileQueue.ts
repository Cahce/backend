
export interface CompileQueue {
  enqueue(jobId: string): Promise<void>;

  start(): void;

  stop(): Promise<void>;

  waitForSettle?(jobId: string): Promise<void>;
}
