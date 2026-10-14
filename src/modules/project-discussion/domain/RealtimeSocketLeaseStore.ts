export type RealtimeSocketLease = { id: string; userId: string };
export interface RealtimeSocketLeaseStore {
  acquire(lease: RealtimeSocketLease, ttlMs: number): Promise<boolean>;
  /** Return only ids whose existing, unexpired reservations were extended. */
  renew(leases: readonly RealtimeSocketLease[], ttlMs: number): Promise<readonly string[]>;
  release(lease: RealtimeSocketLease): Promise<void>;
}
export class RealtimeSocketLeaseUnavailable extends Error {
  constructor() { super('Realtime socket lease unavailable'); this.name = 'RealtimeSocketLeaseUnavailable'; }
}
