import type { ProjectCapabilities } from '../Project/Policies.js';
import type { SharedRole } from '../access/SharingPolicies.js';

export type ProjectActor = { userId: string; role: 'admin' | 'teacher' | 'student' };
export type AccessView = ProjectCapabilities & { version: string; validUntil: string | null };
export type ShareLinkRecord = {
  id: string; projectId: string; label: string | null; role: SharedRole;
  tokenHash: string; expiresAt: Date | null; revokedAt: Date | null;
  version: number; createdAt: Date; updatedAt: Date;
};
export type MemberRecord = { id: string; userId: string; status: 'active' | 'blocked' | 'left';
  roleOverride: SharedRole | null; joinedAt: Date };
export interface SharingSession {
  access(actor: ProjectActor): Promise<AccessView>;
  projectInfo(): Promise<{ id: string; title: string; ownerId: string | null; ownerDisplayName: string }>;
  links(before?: string, limit?: number): Promise<ShareLinkRecord[]>;
  activeLinkCount(): Promise<number>;
  link(id: string): Promise<ShareLinkRecord | null>;
  createLink(data: { actorId: string; role: SharedRole; label: string | null; expiresAt: Date | null; tokenHash: string }): Promise<ShareLinkRecord>;
  updateLink(id: string, patch: Partial<Pick<ShareLinkRecord, 'role' | 'label' | 'expiresAt' | 'tokenHash' | 'revokedAt'>>): Promise<ShareLinkRecord>;
  memberByUser(userId: string): Promise<MemberRecord | null>;
  member(id: string): Promise<MemberRecord | null>;
  grant(userId: string, linkId: string): Promise<void>;
  setMember(id: string, patch: Pick<MemberRecord, 'status' | 'roleOverride'>, revokeGrants: boolean): Promise<MemberRecord>;
  members(before?: string, limit?: number): Promise<Array<MemberRecord & { displayName: string; effectiveRole: SharedRole | null }>>;
  changed(actorId: string, action: string, targetId: string): Promise<void>;
}
export interface SharingRepository {
  readAccess(projectId: string, actor: ProjectActor): Promise<AccessView>;
  transaction<T>(projectId: string, work: (session: SharingSession) => Promise<T>): Promise<T>;
  findLink(id: string): Promise<ShareLinkRecord | null>;
  sharedProjects(actor: ProjectActor, before?: string, limit?: number): Promise<{ projects: Array<Record<string, unknown>>; nextCursor: string | null }>;
}
export interface ShareTokenPort {
  create(): { token: string; hash: string };
  matches(token: string, hash: string): boolean;
}
