import type { ProjectActor, SharingRepository, SharingSession, ShareTokenPort } from '../../domain/sharing/Ports.js';
import type { SharedRole } from '../../domain/access/SharingPolicies.js';
import { requireCondition } from '../../domain/access/CollaborationErrors.js';

export class ProjectSharingUseCases {
  constructor(private readonly repo: SharingRepository, private readonly tokens: ShareTokenPort) {}
  private async owner(session: SharingSession, actor: ProjectActor) {
    const access = await session.access(actor);
    requireCondition(access.canManageSharing, 'SHARING_OWNER_REQUIRED', 'Chỉ chủ dự án được quản lý chia sẻ');
  }
  create(projectId: string, actor: ProjectActor, data: { role: SharedRole; label?: string; expiresAt: string | null }) {
    return this.repo.transaction(projectId, async session => {
      await this.owner(session, actor);
      requireCondition(await session.activeLinkCount() < 20,
        'SHARE_LINK_LIMIT_REACHED', 'Dự án chỉ được có tối đa 20 link chưa thu hồi', 429);
      const secret = this.tokens.create();
      const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
      requireCondition(!expiresAt || expiresAt > new Date(), 'VALIDATION_ERROR', 'Thời hạn phải ở tương lai', 400);
      const link = await session.createLink({ actorId: actor.userId, role: data.role,
        label: data.label?.trim() || null, expiresAt, tokenHash: secret.hash });
      await session.changed(actor.userId, 'share.created', link.id);
      return { link, token: secret.token };
    });
  }
  list(projectId: string, actor: ProjectActor, before?: string, limit = 50) {
    return this.repo.transaction(projectId, async session => { await this.owner(session, actor); const links = await session.links(before, limit);
      return { links, nextCursor: links.length === limit ? links.at(-1)!.id : null }; });
  }
  update(projectId: string, linkId: string, actor: ProjectActor,
    data: { baseVersion: number; role?: SharedRole; label?: string; expiresAt?: string | null }, rotate = false) {
    return this.repo.transaction(projectId, async session => {
      await this.owner(session, actor);
      const link = await session.link(linkId);
      requireCondition(link, 'SHARE_LINK_UNAVAILABLE', 'Link chia sẻ không còn khả dụng', 404);
      requireCondition(!link.revokedAt && link.version === data.baseVersion,
        'SHARE_LINK_VERSION_CONFLICT', 'Link đã thay đổi. Hãy tải lại danh sách', 409);
      const secret = rotate ? this.tokens.create() : null;
      const updated = await session.updateLink(linkId, {
        ...(data.role ? { role: data.role } : {}), ...(data.label !== undefined ? { label: data.label.trim() || null } : {}),
        ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null } : {}),
        ...(secret ? { tokenHash: secret.hash } : {}),
      });
      await session.changed(actor.userId, rotate ? 'share.rotated' : 'share.updated', linkId);
      return { link: updated, token: secret?.token };
    });
  }
  revoke(projectId: string, linkId: string, actor: ProjectActor) {
    return this.repo.transaction(projectId, async session => {
      await this.owner(session, actor);
      const link = await session.link(linkId);
      requireCondition(link, 'SHARE_LINK_UNAVAILABLE', 'Link chia sẻ không còn khả dụng', 404);
      if (link.revokedAt) return;
      await session.updateLink(linkId, { revokedAt: new Date() });
      await session.changed(actor.userId, 'share.revoked', linkId);
    });
  }
  async receive(actor: ProjectActor, linkId: string, token: string, redeem: boolean) {
    const reference = await this.repo.findLink(linkId);
    requireCondition(reference && this.tokens.matches(token, reference.tokenHash),
      'SHARE_LINK_UNAVAILABLE', 'Link chia sẻ không còn khả dụng', 404);
    return this.repo.transaction(reference.projectId, async session => {
      const link = await session.link(linkId);
      const info = await session.projectInfo();
      requireCondition(link && info.ownerId && !link.revokedAt && (!link.expiresAt || link.expiresAt > new Date()) &&
        this.tokens.matches(token, link.tokenHash), 'SHARE_LINK_UNAVAILABLE', 'Link chia sẻ không còn khả dụng', 404);
      const userAccess = await session.access(actor);
      // Access may be none before redeem; active-account validation is enforced by the repository session.
      const member = await session.memberByUser(actor.userId);
      requireCondition(member?.status !== 'blocked', 'MEMBER_BLOCKED', 'Chủ dự án đã chặn quyền tham gia của bạn');
      if (!redeem) return { project: { id: info.id, title: info.title },
        owner: { id: info.ownerId, displayName: info.ownerDisplayName }, role: link.role, expiresAt: link.expiresAt };
      if (userAccess.level !== 'owner') {
        await session.grant(actor.userId, linkId);
        await session.changed(actor.userId, 'member.joined', actor.userId);
      }
      return { projectId: info.id, access: await session.access(actor) };
    });
  }
  members(projectId: string, actor: ProjectActor, before?: string, limit = 50) {
    return this.repo.transaction(projectId, async session => { await this.owner(session, actor); const members = await session.members(before, limit);
      return { members, nextCursor: members.length === limit ? members.at(-1)!.id : null }; });
  }
  changeMember(projectId: string, memberId: string, actor: ProjectActor,
    patch: { roleOverride?: SharedRole | null; status?: 'active' }, block = false) {
    return this.repo.transaction(projectId, async session => {
      await this.owner(session, actor);
      const member = await session.member(memberId);
      requireCondition(member, 'NOT_FOUND', 'Không tìm thấy thành viên', 404);
      const info = await session.projectInfo();
      requireCondition(member.userId !== info.ownerId, 'FORBIDDEN', 'Không thể đổi quyền chủ dự án');
      const result = await session.setMember(member.id, {
        status: block ? 'blocked' : patch.status ?? member.status,
        roleOverride: block ? null : patch.roleOverride !== undefined ? patch.roleOverride : member.roleOverride,
      }, block);
      await session.changed(actor.userId, block ? 'member.blocked' : 'member.updated', member.id);
      return result;
    });
  }
  leave(projectId: string, actor: ProjectActor) {
    return this.repo.transaction(projectId, async session => {
      const access = await session.access(actor);
      requireCondition(access.level !== 'owner', 'FORBIDDEN', 'Chủ dự án không thể rời dự án');
      const member = await session.memberByUser(actor.userId);
      requireCondition(member && member.status !== 'blocked', 'PROJECT_ACCESS_DENIED', 'Bạn không phải thành viên');
      await session.setMember(member.id, { status: 'left', roleOverride: null }, true);
      await session.changed(actor.userId, 'member.left', member.id);
    });
  }
  shared(actor: ProjectActor, before?: string, limit = 50) { return this.repo.sharedProjects(actor, before, limit); }
  async access(projectId: string, actor: ProjectActor) {
    const access = await this.repo.readAccess(projectId, actor);
    requireCondition(access.canRead, 'PROJECT_ACCESS_DENIED', 'Bạn không có quyền truy cập dự án này');
    return access;
  }
}
