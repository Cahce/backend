import type { RealtimeTicketStore, StoredRealtimeTicket, TicketReservation } from '../domain/RealtimeTicketStore.js';

/** Single-process compatibility adapter. Compose Redis explicitly for shared state. */
export class LocalRealtimeTicketStore implements RealtimeTicketStore {
  private readonly entries = new Map<string, StoredRealtimeTicket>();
  private readonly counts = new Map<string, number>();
  constructor(private readonly now: () => number = Date.now) {}

  async put(hash: string, entry: StoredRealtimeTicket): Promise<TicketReservation> {
    const now = this.now();
    for (const [key, value] of this.entries) if (value.deadline <= now) this.remove(key);
    if (entry.deadline <= now) return 'expired';
    if (this.entries.has(hash)) return 'collision';
    const userId = entry.session.actor.userId;
    if ((this.counts.get(userId) ?? 0) >= 10 || this.entries.size >= 5000) return 'capacity';
    this.entries.set(hash, { session: structuredClone(entry.session), deadline: Math.min(entry.deadline, now + 30_000) });
    this.counts.set(userId, (this.counts.get(userId) ?? 0) + 1);
    return 'stored';
  }
  async take(hash: string) {
    const entry = this.remove(hash);
    return entry && entry.deadline > this.now() ? entry : undefined;
  }
  private remove(hash: string) {
    const entry = this.entries.get(hash);
    if (!entry) return;
    this.entries.delete(hash);
    const userId = entry.session.actor.userId, count = (this.counts.get(userId) ?? 1) - 1;
    if (count > 0) this.counts.set(userId, count); else this.counts.delete(userId);
    return entry;
  }
}
