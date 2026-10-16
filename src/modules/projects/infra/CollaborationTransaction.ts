import type { PrismaClient } from '../../../generated/prisma/index.js';
import { Prisma } from '../../../generated/prisma/index.js';
import { capabilitiesFor, resolveProjectAccess } from '../domain/Project/Policies.js';
import { effectiveMembership, type MembershipFacts } from '../domain/access/SharingPolicies.js';
import { requireCondition } from '../domain/access/CollaborationErrors.js';

export type ProjectDb = PrismaClient | Prisma.TransactionClient;
export type Actor = { userId: string; role: 'admin' | 'student' | 'teacher' };
type GrantRow = { revokedAt: string | null; shareLink: {
  role: NonNullable<MembershipFacts['roleOverride']>; revokedAt: string | null; expiresAt: string | null;
} };
type AccessFactsRow = { ownerId: string | null; isActive: boolean | null;
  mustChangePassword: boolean | null; role: Actor['role'] | null; version: string;
  memberStatus: MembershipFacts['status'] | null; roleOverride: MembershipFacts['roleOverride']; grants: GrantRow[] };

function mapAccessFacts(project: AccessFactsRow, now = new Date()) {
  const date = (value: string | null) => value ? new Date(value) : null;
  const member: MembershipFacts | null = project.memberStatus ? { status: project.memberStatus, roleOverride: project.roleOverride,
    grants: project.grants.map(grant => ({ revokedAt: date(grant.revokedAt), shareLink: {
      role: grant.shareLink.role, revokedAt: date(grant.shareLink.revokedAt), expiresAt: date(grant.shareLink.expiresAt),
    } })) } : null;
  const membership = effectiveMembership(member, project.ownerId !== null, now);
  return { ...membership, isAdvisor: false, isActive: !!project.isActive && !project.mustChangePassword,
    version: project.version, ownerId: project.ownerId, role: project.role ?? 'student' };
}

export async function loadAccessFacts(db: ProjectDb, projectId: string, userId: string) {
  // One statement is both a consistent permission snapshot and one DB round trip.
  // The correlated grant lookup is bounded to this exact membership and project.
  // Prisma stores DateTime as UTC timestamp-without-zone; JSON must include the
  // zone explicitly so a server in UTC+7 does not expire links seven hours early.
  const [project] = await db.$queryRaw<AccessFactsRow[]>(Prisma.sql`
    SELECT p."ownerId", u."isActive", u."mustChangePassword", u.role,
      COALESCE(s."accessVersion", 1)::text AS version,
      m.status AS "memberStatus", m."roleOverride",
      COALESCE((SELECT json_agg(json_build_object('revokedAt', g."revokedAt" AT TIME ZONE 'UTC', 'shareLink',
        json_build_object('role', l.role, 'revokedAt', l."revokedAt" AT TIME ZONE 'UTC', 'expiresAt', l."expiresAt" AT TIME ZONE 'UTC')))
        FROM "ProjectAccessGrant" g JOIN "ProjectShareLink" l ON l.id = g."shareLinkId" AND l."projectId" = p.id
        WHERE g."memberId" = m.id AND g."projectId" = p.id), '[]'::json) AS grants
    FROM "Project" p
    LEFT JOIN "User" u ON u.id = ${userId}
    LEFT JOIN "ProjectMember" m ON m."projectId" = p.id AND m."userId" = ${userId}
    LEFT JOIN "ProjectCollaborationState" s ON s."projectId" = p.id
    WHERE p.id = ${projectId}
  `);
  requireCondition(project, 'PROJECT_NOT_FOUND', 'Không tìm thấy dự án', 404);
  return mapAccessFacts(project);
}

export async function accessFor(db: ProjectDb, projectId: string, actor: Actor) {
  const facts = await loadAccessFacts(db, projectId, actor.userId);
  const level = resolveProjectAccess({ ...facts, userId: actor.userId });
  return { ...capabilitiesFor(level), version: facts.version, validUntil: facts.validUntil };
}

/** One primary statement for a bounded, frozen replay cohort; never a permission cache. */
export async function accessForMany(db: ProjectDb, projectId: string, actors: readonly Actor[]) {
  requireCondition(actors.length <= 50, 'VALIDATION_ERROR', 'Nhóm đọc quyền quá lớn', 400);
  const userIds = [...new Set(actors.map(actor => actor.userId))];
  if (!userIds.length) return new Map<string, Awaited<ReturnType<typeof accessFor>>>();
  const rows = await db.$queryRaw<Array<AccessFactsRow & { userId: string }>>(Prisma.sql`
    SELECT wanted."userId", p."ownerId", u."isActive", u."mustChangePassword", u.role,
      COALESCE(s."accessVersion", 1)::text AS version,
      m.status AS "memberStatus", m."roleOverride",
      COALESCE((SELECT json_agg(json_build_object('revokedAt', g."revokedAt" AT TIME ZONE 'UTC', 'shareLink',
        json_build_object('role', l.role, 'revokedAt', l."revokedAt" AT TIME ZONE 'UTC', 'expiresAt', l."expiresAt" AT TIME ZONE 'UTC')))
        FROM "ProjectAccessGrant" g JOIN "ProjectShareLink" l ON l.id = g."shareLinkId" AND l."projectId" = p.id
        WHERE g."memberId" = m.id AND g."projectId" = p.id), '[]'::json) AS grants
    FROM "Project" p
    CROSS JOIN (VALUES ${Prisma.join(userIds.map(userId => Prisma.sql`(${userId}::text)`))}) wanted("userId")
    LEFT JOIN "User" u ON u.id = wanted."userId"
    LEFT JOIN "ProjectMember" m ON m."projectId" = p.id AND m."userId" = wanted."userId"
    LEFT JOIN "ProjectCollaborationState" s ON s."projectId" = p.id
    WHERE p.id = ${projectId}
  `);
  requireCondition(rows.length, 'PROJECT_NOT_FOUND', 'Không tìm thấy dự án', 404);
  const now = new Date();
  return new Map(rows.map(row => {
    const facts = mapAccessFacts(row, now);
    const level = resolveProjectAccess({ ...facts, userId: row.userId });
    return [row.userId, { ...capabilitiesFor(level), version: facts.version, validUntil: facts.validUntil }];
  }));
}

/** Serialize project mutations and revocation; never hold this lock for external IO. */
export async function lockProject(tx: Prisma.TransactionClient, projectId: string) {
  const exists = await tx.project.findUnique({ where: { id: projectId }, select: { id: true } });
  requireCondition(exists, 'PROJECT_NOT_FOUND', 'Không tìm thấy dự án', 404);
  await tx.$executeRaw`INSERT INTO "ProjectCollaborationState" ("projectId", "lastEventSeq", "accessVersion")
    VALUES (${projectId}, 0, 1) ON CONFLICT ("projectId") DO NOTHING`;
  await tx.$queryRaw`SELECT "projectId" FROM "ProjectCollaborationState" WHERE "projectId" = ${projectId} FOR UPDATE`;
}

export async function appendProjectEvent(tx: Prisma.TransactionClient, projectId: string, type: string,
  entityId: string | null, actorId: string | null, metadata: Prisma.InputJsonValue = {}, changeAccess = false) {
  const state = await tx.projectCollaborationState.update({ where: { projectId }, data: {
    lastEventSeq: { increment: 1 }, ...(changeAccess ? { accessVersion: { increment: 1 } } : {}),
  } });
  await tx.projectEvent.create({ data: { projectId, seq: state.lastEventSeq, type, entityId, actorId, metadata } });
  // PostgreSQL publishes this hint only on COMMIT; rollback emits nothing. Repeated
  // hints for a project in one transaction are coalesced, so replay must drain pages.
  await tx.$executeRaw`SELECT pg_notify('project_events_' || md5(current_schema()), ${projectId})`;
  return state.lastEventSeq;
}
