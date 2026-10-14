export type SharedRole = 'viewer' | 'commenter' | 'editor';
const ROLE_RANK: Record<SharedRole, number> = { viewer: 1, commenter: 2, editor: 3 };

export interface MembershipFacts {
  status: 'active' | 'blocked' | 'left';
  roleOverride: SharedRole | null;
  grants: Array<{ revokedAt: Date | null; shareLink: {
    role: SharedRole; revokedAt: Date | null; expiresAt: Date | null;
  } }>;
}

export function effectiveMembership(member: MembershipFacts | null, hasOwner: boolean, now = new Date()):
  { membershipRole: SharedRole | null; validUntil: string | null } {
  if (!hasOwner || !member || member.status !== 'active') return { membershipRole: null, validUntil: null };
  if (member.roleOverride) return { membershipRole: member.roleOverride, validUntil: null };
  let role: SharedRole | null = null;
  let validUntil: Date | null = null;
  for (const grant of member.grants) {
    const link = grant.shareLink;
    if (grant.revokedAt || link.revokedAt || (link.expiresAt && link.expiresAt <= now)) continue;
    if (!role || ROLE_RANK[link.role] > ROLE_RANK[role]) role = link.role;
    if (link.expiresAt && (!validUntil || link.expiresAt < validUntil)) validUntil = link.expiresAt;
  }
  return { membershipRole: role, validUntil: validUntil?.toISOString() ?? null };
}
