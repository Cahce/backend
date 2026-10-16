import type { PrismaClient } from '../../../generated/prisma/index.js';
import type { RealtimeSession, RealtimeSessionPolicy } from '../domain/RealtimePorts.js';
import { effectiveMembership, type MembershipFacts } from '../../projects/domain/access/SharingPolicies.js';
import { capabilitiesFor, resolveProjectAccess } from '../../projects/domain/Project/Policies.js';

type Pending = { session: RealtimeSession; resolve(value: boolean): void; reject(reason: unknown): void };
const MAX_BATCH = 200;
const MAX_PENDING = 1000;
type GrantFacts = { revokedAt: string | null; shareLink: {
  role: NonNullable<MembershipFacts['roleOverride']>; revokedAt: string | null; expiresAt: string | null;
} };
type ValidationFactsRow = { idx: number; projectId: string | null; ownerId: string | null; userId: string | null;
  role: RealtimeSession['actor']['role'] | null; isActive: boolean | null; mustChangePassword: boolean | null;
  memberStatus: MembershipFacts['status'] | null; roleOverride: MembershipFacts['roleOverride']; grants: GrantFacts[]; revoked: boolean };

/** Coalesces concurrent checks, never caches a permission result across checks. */
export class BatchedRealtimeSessionPolicy implements RealtimeSessionPolicy {
  private pending: Pending[] = [];
  private scheduled = false;
  private running = false;
  private readonly transactionMaxWait: number;
  constructor(private readonly prisma: PrismaClient, options: { connectionTimeoutMs?: number } = {}) {
    const connectionTimeoutMs = options.connectionTimeoutMs ?? 5000;
    if (!Number.isSafeInteger(connectionTimeoutMs) || connectionTimeoutMs < 1 || connectionTimeoutMs > 60_000)
      throw new Error('Invalid realtime validation connection timeout');
    this.transactionMaxWait = connectionTimeoutMs + 1000;
  }

  validate(session: RealtimeSession): Promise<boolean> {
    if (!session.jti || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now() || this.pending.length >= MAX_PENDING)
      return Promise.resolve(false);
    const result = new Promise<boolean>((resolve, reject) => this.pending.push({ session, resolve, reject }));
    this.schedule();
    return result;
  }
  private schedule() {
    if (this.scheduled || this.running || !this.pending.length) return;
    this.scheduled = true;
    setImmediate(() => { this.scheduled = false; void this.flush(); });
  }
  private async flush() {
    if (this.running) return;
    this.running = true;
    const batch = this.pending.splice(0, MAX_BATCH);
    try {
      const requested = batch.map(({ session: s }) => ({ projectId: s.projectId, userId: s.actor.userId, jti: s.jti }));
      // One primary statement observes membership, current user flags and each JTI together.
      // The server cancels SQL; running remains reserved until the whole transaction settles.
      const rows = await this.prisma.$transaction(async tx => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        await tx.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
        return tx.$queryRaw<ValidationFactsRow[]>`
          WITH requested AS MATERIALIZED (
            SELECT (r.ordinal - 1)::integer AS idx, r.value->>'projectId' AS "projectId",
              r.value->>'userId' AS "userId", r.value->>'jti' AS jti
            FROM jsonb_array_elements(${JSON.stringify(requested)}::jsonb) WITH ORDINALITY AS r(value, ordinal)
          ), facts AS MATERIALIZED (
            SELECT wanted."projectId" AS "requestedProjectId", wanted."userId" AS "requestedUserId",
              p.id AS "projectId", p."ownerId", u.id AS "userId", u.role, u."isActive", u."mustChangePassword",
              m.status AS "memberStatus", m."roleOverride",
              COALESCE((SELECT json_agg(json_build_object('revokedAt', g."revokedAt" AT TIME ZONE 'UTC', 'shareLink',
                json_build_object('role', l.role, 'revokedAt', l."revokedAt" AT TIME ZONE 'UTC', 'expiresAt', l."expiresAt" AT TIME ZONE 'UTC')))
                FROM "ProjectAccessGrant" g JOIN "ProjectShareLink" l ON l.id = g."shareLinkId" AND l."projectId" = p.id
                WHERE g."memberId" = m.id AND g."projectId" = p.id AND g."revokedAt" IS NULL AND l."revokedAt" IS NULL), '[]'::json) AS grants
            FROM (SELECT DISTINCT "projectId", "userId" FROM requested) wanted
            LEFT JOIN "Project" p ON p.id = wanted."projectId"
            LEFT JOIN "User" u ON u.id = wanted."userId"
            LEFT JOIN "ProjectMember" m ON m."projectId" = p.id AND m."userId" = u.id
          )
          SELECT requested.idx, facts."projectId", facts."ownerId", facts."userId", facts.role,
            facts."isActive", facts."mustChangePassword", facts."memberStatus", facts."roleOverride", facts.grants,
            (revoked.jti IS NOT NULL) AS revoked
          FROM requested
          JOIN facts ON facts."requestedProjectId" = requested."projectId" AND facts."requestedUserId" = requested."userId"
          LEFT JOIN "InvalidToken" revoked ON revoked.jti = requested.jti
          ORDER BY requested.idx
        `;
      }, { maxWait: this.transactionMaxWait, timeout: 4000 });
      const byIndex = new Map(rows.map(row => [row.idx, row]));
      if (rows.length !== batch.length || byIndex.size !== batch.length || batch.some((_, index) => !byIndex.has(index)))
        throw new Error('Incomplete realtime validation snapshot');
      const now = new Date();
      for (const [index, entry] of batch.entries()) {
        const s = entry.session, row = byIndex.get(index)!, identity = requested[index];
        if (!row.projectId || !row.userId || !row.isActive || row.mustChangePassword || row.revoked || !row.role ||
          !Number.isFinite(s.expiresAt) || s.expiresAt <= now.getTime() || s.projectId !== identity.projectId ||
          s.actor.userId !== identity.userId || s.jti !== identity.jti) {
          entry.resolve(false); continue;
        }
        const date = (value: string | null) => value ? new Date(value) : null;
        const member: MembershipFacts | null = row.memberStatus ? { status: row.memberStatus, roleOverride: row.roleOverride,
          grants: row.grants.map(grant => ({ revokedAt: date(grant.revokedAt), shareLink: {
            role: grant.shareLink.role, revokedAt: date(grant.shareLink.revokedAt), expiresAt: date(grant.shareLink.expiresAt),
          } })) } : null;
        const membership = effectiveMembership(member, row.ownerId !== null, now);
        const level = resolveProjectAccess({ ...membership, userId: row.userId, ownerId: row.ownerId,
          role: row.role, isActive: true, isAdvisor: false });
        entry.resolve(capabilitiesFor(level).canReadChat);
      }
    } catch (error) { for (const entry of batch) entry.reject(error); }
    finally { this.running = false; this.schedule(); }
  }
}
