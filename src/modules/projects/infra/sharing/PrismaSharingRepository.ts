import { Prisma, type PrismaClient } from '../../../../generated/prisma/index.js';
import type { SharingRepository, SharingSession, ProjectActor, ShareLinkRecord } from '../../domain/sharing/Ports.js';
import { accessFor, appendProjectEvent, lockProject } from '../CollaborationTransaction.js';
import { effectiveMembership } from '../../domain/access/SharingPolicies.js';
import { requireCondition } from '../../domain/access/CollaborationErrors.js';
import { capabilitiesFor } from '../../domain/Project/Policies.js';

const profileSelect = { student: { select: { fullName: true } }, teacher: { select: { fullName: true } } } as const;
function displayName(user: { student: { fullName: string } | null; teacher: { fullName: string } | null } | null) {
  return user?.student?.fullName || user?.teacher?.fullName || 'Thành viên';
}

export class PrismaSharingRepository implements SharingRepository {
  constructor(private readonly prisma: PrismaClient) {}
  readAccess(projectId: string, actor: ProjectActor) {
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      return accessFor(tx, projectId, actor);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 10_000, timeout: 10_000 });
  }
  findLink(id: string): Promise<ShareLinkRecord | null> {
    return this.prisma.projectShareLink.findUnique({ where: { id } });
  }
  transaction<T>(projectId: string, work: (session: SharingSession) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async tx => {
      await lockProject(tx, projectId);
      return work(this.session(tx, projectId));
    }, { timeout: 10000 });
  }
  private session(tx: Prisma.TransactionClient, projectId: string): SharingSession {
    return {
      access: async actor => {
        const user = await tx.user.findUnique({ where: { id: actor.userId }, select: { isActive: true, mustChangePassword: true } });
        requireCondition(user?.isActive && !user.mustChangePassword, 'PROJECT_ACCESS_DENIED', 'Tài khoản chưa đủ điều kiện tham gia');
        return accessFor(tx, projectId, actor);
      },
      projectInfo: async () => {
        const p = await tx.project.findUniqueOrThrow({ where: { id: projectId }, include: { owner: { select: profileSelect } } });
        return { id: p.id, title: p.title, ownerId: p.ownerId, ownerDisplayName: displayName(p.owner) };
      },
      links: (before, limit = 50) => tx.projectShareLink.findMany({ where: { projectId, ...(before ? { id: { lt: before } } : {}) }, orderBy: { id: 'desc' }, take: limit }),
      activeLinkCount: () => tx.projectShareLink.count({ where: { projectId, revokedAt: null } }),
      link: id => tx.projectShareLink.findFirst({ where: { id, projectId } }),
      createLink: data => tx.projectShareLink.create({ data: { projectId, createdById: data.actorId,
        role: data.role, label: data.label, expiresAt: data.expiresAt, tokenHash: data.tokenHash } }),
      updateLink: (id, patch) => tx.projectShareLink.update({ where: { id, projectId }, data: { ...patch, version: { increment: 1 } } }),
      memberByUser: userId => tx.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } }),
      member: id => tx.projectMember.findFirst({ where: { id, projectId } }),
      grant: async (userId, shareLinkId) => {
        const member = await tx.projectMember.upsert({ where: { projectId_userId: { projectId, userId } },
          create: { projectId, userId }, update: { status: 'active' } });
        await tx.projectAccessGrant.upsert({ where: { memberId_shareLinkId: { memberId: member.id, shareLinkId } },
          create: { projectId, memberId: member.id, shareLinkId }, update: { revokedAt: null, redeemedAt: new Date() } });
      },
      setMember: async (id, patch, revokeGrants) => {
        if (revokeGrants) await tx.projectAccessGrant.updateMany({ where: { memberId: id, projectId }, data: { revokedAt: new Date() } });
        return tx.projectMember.update({ where: { id, projectId }, data: patch });
      },
      members: async (before, limit = 50) => {
        const rows = await tx.projectMember.findMany({ where: { projectId, ...(before ? { id: { lt: before } } : {}) }, take: limit, orderBy: { id: 'desc' },
          include: { user: { select: profileSelect }, grants: { include: { shareLink: true } } } });
        return rows.map(m => ({ id: m.id, userId: m.userId, status: m.status, roleOverride: m.roleOverride,
          joinedAt: m.joinedAt, displayName: displayName(m.user), effectiveRole: effectiveMembership(m, true).membershipRole }));
      },
      changed: async (actorId, action, targetId) => {
        await tx.projectAccessAudit.create({ data: { projectId, actorId, action, targetId } });
        await appendProjectEvent(tx, projectId, 'project.access.changed', null, actorId, {}, true);
      },
    };
  }
  async sharedProjects(actor: ProjectActor, before?: string, limit = 50) {
    const user = await this.prisma.user.findUnique({ where: { id: actor.userId }, select: { isActive: true, mustChangePassword: true } });
    requireCondition(user?.isActive && !user.mustChangePassword, 'PROJECT_ACCESS_DENIED', 'Tài khoản chưa đủ điều kiện truy cập');
    const now = new Date();
    const rows = await this.prisma.projectMember.findMany({ where: { userId: actor.userId, status: 'active', ...(before ? { id: { lt: before } } : {}),
      project: { ownerId: { not: null } }, OR: [{ roleOverride: { not: null } }, { grants: { some: {
        revokedAt: null, shareLink: { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      } } }] }, take: limit, orderBy: { id: 'desc' },
      include: { grants: { include: { shareLink: true } }, project: { include: {
        owner: { select: profileSelect }, collaborationState: true } } } });
    const projects = rows.flatMap(m => {
      const membership = effectiveMembership(m, m.project.ownerId !== null, now);
      if (!membership.membershipRole || m.project.ownerId === actor.userId) return [];
      const p = m.project;
      return [{ id: p.id, title: p.title, category: p.category, ownerId: p.ownerId,
        createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(), lastEditedAt: p.lastEditedAt?.toISOString() ?? null,
        metadataRevision: p.metadataRevision, ownerDisplayName: displayName(p.owner), access: {
          ...capabilitiesFor(membership.membershipRole), version: (p.collaborationState?.accessVersion ?? 1n).toString(),
          validUntil: membership.validUntil,
        } }];
    });
    return { projects, nextCursor: rows.length === limit ? rows.at(-1)!.id : null };
  }
}
