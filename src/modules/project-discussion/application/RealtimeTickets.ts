import type { RealtimeSession, RealtimeSessionPolicy } from '../domain/RealtimePorts.js';
import { CollaborationError, requireCondition } from '../../projects/domain/access/CollaborationErrors.js';
import { RealtimeTicketStoreUnavailable, type RealtimeTicketStore } from '../domain/RealtimeTicketStore.js';
export interface TicketTokens { generate(): string; hash(value: string): string }
/** One-use credentials; authorization remains a fresh primary policy check. */
export class RealtimeTickets {
  constructor(private readonly tokens: TicketTokens, private readonly policy: RealtimeSessionPolicy,
    private readonly store: RealtimeTicketStore) {}
  async create(session: RealtimeSession) {
    requireCondition(await this.policy.validate(session), 'PROJECT_ACCESS_DENIED', 'Không thể kết nối thảo luận');
    const deadline = Math.min(Date.now() + 30_000, session.expiresAt);
    requireCondition(Number.isSafeInteger(deadline) && deadline > Date.now(), 'INVALID_REALTIME_TICKET', 'Phiên kết nối đã hết hạn', 401);
    // A collision must never replace an already issued credential.
    for (let attempt = 0; attempt < 3; attempt++) {
      const ticket = this.tokens.generate();
      const result = await this.useStore(() => this.store.put(this.tokens.hash(ticket), { session, deadline }));
      if (result === 'stored') return { ticket, expiresAt: new Date(deadline).toISOString() };
      if (result === 'capacity') throw new CollaborationError('REALTIME_BUSY', 'Có quá nhiều kết nối đang chờ. Hãy thử lại sau', 429);
      requireCondition(result !== 'expired', 'INVALID_REALTIME_TICKET', 'Phiên kết nối đã hết hạn', 401);
    }
    throw new CollaborationError('REALTIME_UNAVAILABLE', 'Không thể tạo kết nối. Hãy thử lại sau', 503);
  }
  async consume(projectId: string, ticket: string) {
    requireCondition(/^[A-Za-z0-9_-]{43}$/.test(ticket), 'INVALID_REALTIME_TICKET', 'Mã kết nối không hợp lệ', 401);
    const entry = await this.useStore(() => this.store.take(this.tokens.hash(ticket)));
    requireCondition(entry && entry.deadline > Date.now() && entry.session.expiresAt > Date.now() && entry.session.projectId === projectId,
      'INVALID_REALTIME_TICKET', 'Mã kết nối không hợp lệ', 401);
    requireCondition(await this.policy.validate(entry.session), 'PROJECT_ACCESS_DENIED', 'Quyền truy cập đã thay đổi');
    return entry.session;
  }
  validate(session: RealtimeSession) { return this.policy.validate(session); }
  private async useStore<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch (error) {
      if (!(error instanceof RealtimeTicketStoreUnavailable)) throw error;
      throw new CollaborationError('REALTIME_UNAVAILABLE', 'Dịch vụ kết nối đang bận. Hãy thử lại sau', 503);
    }
  }
}
