import type { RealtimeSocketLease, RealtimeSocketLeaseStore } from '../domain/RealtimeSocketLeaseStore.js';

export class LocalRealtimeSocketLeaseStore implements RealtimeSocketLeaseStore {
  private readonly leases = new Map<string, { userId: string; deadline: number }>();
  constructor(private readonly globalLimit = 10000, private readonly perUserLimit = 5, private readonly now: () => number = Date.now) {}
  async acquire(lease: RealtimeSocketLease, ttlMs: number) {
    const now = this.now();
    for (const [id, value] of this.leases) if (value.deadline <= now) this.leases.delete(id);
    if (this.leases.has(lease.id) || this.leases.size >= this.globalLimit ||
      [...this.leases.values()].filter(value => value.userId === lease.userId).length >= this.perUserLimit) return false;
    this.leases.set(lease.id, { userId: lease.userId, deadline: now + ttlMs }); return true;
  }
  async renew(leases: readonly RealtimeSocketLease[], ttlMs: number) {
    const now = this.now(), renewed: string[] = [];
    for (const lease of leases) {
      const value = this.leases.get(lease.id);
      if (!value || value.userId !== lease.userId || value.deadline <= now) continue;
      value.deadline = now + ttlMs; renewed.push(lease.id);
    }
    return renewed;
  }
  async release(lease: RealtimeSocketLease) {
    if (this.leases.get(lease.id)?.userId === lease.userId) this.leases.delete(lease.id);
  }
}
