import { createClient } from '@redis/client';

export interface RedisCommands { command(args: readonly string[]): Promise<unknown> }
export interface RedisConnectionClient {
  readonly isReady: boolean;
  connect(): Promise<unknown>;
  sendCommand(args: readonly string[]): Promise<unknown>;
  destroy(): void;
  on(event: 'error' | 'end', listener: () => void): unknown;
}
export type RedisConnectionOptions = { url: string; commandTimeoutMs: number; connectTimeoutMs: number; maxPending: number };
export class SharedStateUnavailable extends Error {
  constructor() { super('Shared state unavailable'); this.name = 'SharedStateUnavailable'; }
}
type Generation = { client: RedisConnectionClient; cancel: Set<() => void> };

/** No offline replay. A deadline destroys the entire socket, including waiting-for-reply buffers. */
export class BoundedRedisConnection implements RedisCommands {
  private current?: Generation;
  private stopped = true;
  private retry?: ReturnType<typeof setTimeout>;
  private failures = 0;
  private pending = 0;
  private readonly counters = { attempts: 0, completed: 0, errors: 0, timeouts: 0, rejected: 0 };
  constructor(private readonly options: RedisConnectionOptions,
    private readonly factory: () => RedisConnectionClient = () => createClient({
      // Reserve fixed space for HELLO/AUTH/CLIENT SETINFO even when application cap is 1.
      url: options.url, disableOfflineQueue: true, commandsQueueMaxLength: options.maxPending + 8,
      socket: { reconnectStrategy: false, connectTimeout: options.connectTimeoutMs },
    })) {}

  get isReady() { return !this.stopped && this.current?.client.isReady === true; }
  snapshot() { return { ...this.counters, pending: this.pending, ready: Number(this.isReady) }; }
  async start() {
    if (!this.stopped) return;
    this.stopped = false;
    await this.connect();
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.retry); this.retry = undefined;
    if (this.current) this.drop(this.current);
  }
  async command(args: readonly string[]): Promise<unknown> {
    const generation = this.current;
    if (!this.isReady || !generation || this.pending >= this.options.maxPending) {
      this.counters.rejected++;
      throw new SharedStateUnavailable();
    }
    this.pending++;
    try {
      const result = await this.bounded(generation, () => generation.client.sendCommand(args), this.options.commandTimeoutMs);
      this.counters.completed++;
      return result;
    } catch {
      this.counters.errors++;
      // Never propagate an upstream error containing a URL, command arguments or payload.
      throw new SharedStateUnavailable();
    } finally { this.pending--; }
  }
  private async connect() {
    if (this.stopped || this.current) return;
    this.counters.attempts++;
    let generation: Generation | undefined;
    try {
      generation = { client: this.factory(), cancel: new Set() };
      this.current = generation;
      const active = generation;
      active.client.on('error', () => this.drop(active));
      active.client.on('end', () => this.drop(active));
      await this.bounded(active, () => active.client.connect(), this.options.connectTimeoutMs);
      if (this.current === active && active.client.isReady) this.failures = 0;
      else this.drop(active);
    } catch {
      if (generation) this.drop(generation); else this.scheduleReconnect();
    }
  }
  private bounded(generation: Generation, run: () => Promise<unknown>, deadline: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (failed: boolean, value?: unknown) => {
        if (done) return;
        done = true; clearTimeout(timer); generation.cancel.delete(cancel);
        if (failed) reject(new SharedStateUnavailable()); else resolve(value);
      };
      const cancel = () => finish(true);
      const timer = setTimeout(() => { this.counters.timeouts++; this.drop(generation); }, deadline);
      generation.cancel.add(cancel);
      // run() may throw synchronously (closed client, validation), or reject after a deadline.
      try { void run().then(value => finish(false, value), () => finish(true)); }
      catch { finish(true); }
    });
  }
  private drop(generation: Generation) {
    if (this.current !== generation) return;
    this.current = undefined;
    for (const cancel of generation.cancel) cancel();
    try { generation.client.destroy(); } catch { /* Already closed; do not leak client errors. */ }
    this.scheduleReconnect();
  }
  private scheduleReconnect() {
    if (this.stopped || this.retry) return;
    const delay = Math.min(250 * 2 ** Math.min(this.failures++, 5), 5000) + Math.floor(Math.random() * 250);
    this.retry = setTimeout(() => { this.retry = undefined; void this.connect(); }, delay);
    this.retry.unref();
  }
}
