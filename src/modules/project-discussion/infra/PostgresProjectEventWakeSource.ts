import { Client, type ClientConfig, type Notification } from 'pg';
import type { ProjectEventWakeSource } from '../domain/RealtimePorts.js';

const CHANNEL_PATTERN = /^project_events_[a-f0-9]{32}$/;
const PROJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,190}$/;

/** A notification is only a wake hint. Replay always reads authorized durable events. */
export class PostgresProjectEventWakeSource implements ProjectEventWakeSource {
  private readonly listeners = new Set<(projectId: string) => void>();
  private client?: Client;
  private connecting?: Promise<void>;
  private retryTimer?: NodeJS.Timeout;
  private stopped = true;
  private generation = 0;
  private failures = 0;

  constructor(private readonly config: ClientConfig, private readonly warn: (message: string) => void = () => {}) {}

  subscribe(listener: (projectId: string) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  async start() {
    if (!this.stopped) return this.connecting;
    this.stopped = false;
    this.generation++;
    await this.connect();
  }

  async stop() {
    this.stopped = true;
    this.generation++;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    const client = this.client;
    this.client = undefined;
    // Ending the dedicated session also removes LISTEN; it never borrows a pool client.
    if (client) await client.end().catch(() => {});
    await this.connecting;
  }

  private connect(): Promise<void> {
    if (this.stopped || this.connecting) return this.connecting ?? Promise.resolve();
    const generation = this.generation;
    const attempt = this.open(generation);
    this.connecting = attempt;
    void attempt.finally(() => { if (this.connecting === attempt) this.connecting = undefined; });
    return attempt;
  }

  private async open(generation: number) {
    const client = new Client({ connectionTimeoutMillis: 5000, query_timeout: 5000, keepAlive: true, ...this.config });
    this.client = client;
    let channel: string | undefined;
    const isCurrent = () => !this.stopped && generation === this.generation && this.client === client;
    const disconnected = () => {
      if (!isCurrent()) return;
      this.client = undefined;
      void client.end().catch(() => {});
      this.scheduleReconnect();
    };
    client.on('error', disconnected);
    client.on('end', disconnected);
    client.on('notification', (notification: Notification) => {
      if (!isCurrent() || notification.channel !== channel || !notification.payload || !PROJECT_ID_PATTERN.test(notification.payload)) return;
      for (const listener of this.listeners) {
        try { listener(notification.payload); }
        catch { this.warn('Project event wake listener failed; durable replay remains available'); }
      }
    });
    try {
      await client.connect();
      const result = await client.query<{ channel: string }>("SELECT 'project_events_' || md5(current_schema()) AS channel");
      channel = result.rows[0]?.channel;
      if (!channel || !CHANNEL_PATTERN.test(channel)) throw new Error('Invalid project event channel');
      // The identifier is derived by PostgreSQL and constrained above before interpolation.
      await client.query(`LISTEN "${channel}"`);
      if (!isCurrent()) { await client.end().catch(() => {}); return; }
      this.failures = 0;
    } catch {
      if (isCurrent()) {
        this.client = undefined;
        this.scheduleReconnect();
      }
      await client.end().catch(() => {});
    }
  }

  private scheduleReconnect() {
    if (this.stopped || this.retryTimer) return;
    this.warn('Project event notifications unavailable; using durable replay while reconnecting');
    const delay = Math.min(250 * 2 ** Math.min(this.failures++, 6), 10_000) + Math.floor(Math.random() * 100);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      void (async () => { await this.connecting; if (!this.stopped) await this.connect(); })();
    }, delay);
    this.retryTimer.unref();
  }
}
