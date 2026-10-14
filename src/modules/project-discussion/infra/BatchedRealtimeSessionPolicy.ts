import type { PrismaClient } from '../../../generated/prisma/index.js';
import type { RealtimeSession, RealtimeSessionPolicy } from '../domain/RealtimePorts.js';
import { effectiveMembership } from '../../projects/domain/access/SharingPolicies.js';
import { capabilitiesFor, resolveProjectAccess } from '../../projects/domain/Project/Policies.js';

type Pending = { session: RealtimeSession; resolve(value: boolean): void; reject(reason: unknown): void };
const MAX_BATCH = 200;
const MAX_PENDING = 1000;
const key = (projectId: string, userId: string) => JSON.stringify([projectId, userId]);

/** Coalesces concurrent checks, never caches a permission result across checks. */
export class BatchedRealtimeSessionPolicy implements RealtimeSessionPolicy {
  private pending: Pending[] = [];
  private scheduled = false;
  private running = false;
  constructor(private readonly prisma: PrismaClient) {}

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
      const pairs = [...new Map(batch.map(({ session: s }) => [key(s.projectId, s.actor.userId),
        { projectId: s.projectId, userId: s.actor.userId }])).values()];
      const projectIds = [...new Set(pairs.map(p => p.projectId))], userIds = [...new Set(pairs.map(p => p.userId))];
      const jtis = [...new Set(batch.map(p => p.session.jti))];
      // Set-based queries avoid a cascade of per-socket lookups on every authorization tick.
      // No collaboration event/version or profile/source data is needed for this boolean policy.
      const [projects, users, members, revoked] = await Promise.all([
        this.prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, ownerId: true } }),
        this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, isActive: true, mustChangePassword: true, role: true } }),
        this.prisma.projectMember.findMany({ where: { OR: pairs }, select: { projectId: true, userId: true, status: true, roleOverride: true,
          grants: { select: { revokedAt: true, shareLink: { select: { role: true, revokedAt: true, expiresAt: true } } } } } }),
        this.prisma.invalidToken.findMany({ where: { jti: { in: jtis } }, select: { jti: true } }),
      ]);
      const projectMap = new Map(projects.map(p => [p.id, p])), userMap = new Map(users.map(u => [u.id, u]));
      const memberMap = new Map(members.map(m => [key(m.projectId, m.userId), m]));
      const revokedSet = new Set(revoked.map(t => t.jti)), now = new Date();
      for (const entry of batch) {
        const s = entry.session, project = projectMap.get(s.projectId), user = userMap.get(s.actor.userId);
        if (!project || !user || !user.isActive || user.mustChangePassword || revokedSet.has(s.jti) || s.expiresAt <= now.getTime()) {
          entry.resolve(false); continue;
        }
        const membership = effectiveMembership(memberMap.get(key(s.projectId, s.actor.userId)) ?? null, project.ownerId !== null, now);
        const level = resolveProjectAccess({ ...membership, userId: user.id, ownerId: project.ownerId,
          role: user.role, isActive: true, isAdvisor: false });
        entry.resolve(capabilitiesFor(level).canReadChat);
      }
    } catch (error) { for (const entry of batch) entry.reject(error); }
    finally { this.running = false; this.schedule(); }
  }
}
