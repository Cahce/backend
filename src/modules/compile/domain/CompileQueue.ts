
export interface CompileQueue {
  admit<T>(key: string, work: (enqueue: (jobId: string) => Promise<void>) => Promise<T>): Promise<T>;
  hasJob(jobId: string): boolean;
  enqueue(jobId: string): Promise<void>;

  start(): void;

  stop(): Promise<void>;

  waitForSettle?(jobId: string, signal?: AbortSignal): Promise<void>;
}
