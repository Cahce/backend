import type { RealtimeSession } from './RealtimePorts.js';

export type StoredRealtimeTicket = { session: RealtimeSession; deadline: number };
export type TicketReservation = 'stored' | 'capacity' | 'collision' | 'expired';
export interface RealtimeTicketStore {
  /** Atomically reserve a hash with a 30s maximum TTL, 10/user and 5000 total pending tickets. */
  put(hash: string, entry: StoredRealtimeTicket): Promise<TicketReservation>;
  /** Delete before returning, including when the caller later rejects the project or policy. */
  take(hash: string): Promise<StoredRealtimeTicket | undefined>;
}

export class RealtimeTicketStoreUnavailable extends Error {
  constructor() { super('Realtime ticket store unavailable'); this.name = 'RealtimeTicketStoreUnavailable'; }
}
