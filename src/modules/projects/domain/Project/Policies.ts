
import type { Project } from './Types.js';

export type ProjectAccessLevel =
  | 'owner'
  | 'editor'
  | 'commenter'
  | 'viewer'
  | 'advisor'
  | 'adminOversight'
  | 'none';

export interface AuthContext {
  userId: string;
  role: 'admin' | 'teacher' | 'student';
  membershipRole?: 'editor' | 'commenter' | 'viewer' | null;
  isActive?: boolean;
  version?: string;
  validUntil?: string | null;
  isAdvisor?: boolean;
}

export interface AccessResolutionInput {
  ownerId: string | null;
  userId: string;
  role: 'admin' | 'teacher' | 'student';
  membershipRole?: 'editor' | 'commenter' | 'viewer' | null;
  isActive?: boolean;
  isAdvisor?: boolean;
}

export function resolveProjectAccess(input: AccessResolutionInput): ProjectAccessLevel {
  if (input.isActive === false) return 'none';
  if (input.ownerId !== null && input.ownerId === input.userId) {
    return 'owner';
  }
  if (input.membershipRole === 'editor') {
    return 'editor';
  }
  if (input.isAdvisor === true) {
    return 'advisor';
  }
  if (input.membershipRole === 'commenter') return 'commenter';
  if (input.membershipRole === 'viewer') {
    return 'viewer';
  }
  if (input.role === 'admin') {
    return 'adminOversight';
  }
  return 'none';
}

export interface ProjectCapabilities {
  level: ProjectAccessLevel;
  canRead: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageSettings: boolean;
  canCompileOfficial: boolean;
  canManageSharing: boolean;
  canReadChat: boolean;
  canSendChat: boolean;
  canReadComments: boolean;
  canComment: boolean;
  canModerateDiscussion: boolean;
  canExportProject: boolean;
  canDuplicateProject: boolean;
}

const READ_LEVELS: ReadonlySet<ProjectAccessLevel> = new Set([
  'owner',
  'editor',
  'viewer',
  'commenter',
  'advisor',
  'adminOversight',
]);

const WRITE_LEVELS: ReadonlySet<ProjectAccessLevel> = new Set([
  'owner',
  'editor',
]);

export function capabilitiesFor(level: ProjectAccessLevel): ProjectCapabilities {
  const canRead = READ_LEVELS.has(level);
  const canWrite = WRITE_LEVELS.has(level);
  const canDiscuss = ['owner', 'editor', 'commenter', 'viewer'].includes(level);
  return {
    level,
    canRead,
    canEdit: canWrite,
    canDelete: level === 'owner',
    canManageSettings: canWrite,
    canCompileOfficial: canWrite,
    canManageSharing: level === 'owner',
    canReadChat: canDiscuss,
    canSendChat: canDiscuss,
    canReadComments: canDiscuss,
    canComment: ['owner', 'editor', 'commenter'].includes(level),
    canModerateDiscussion: level === 'owner',
    canExportProject: canWrite,
    canDuplicateProject: canWrite,
  };
}

export class ProjectAuthPolicy {
  static level(project: Project, auth: AuthContext): ProjectAccessLevel {
    return resolveProjectAccess({
      ownerId: project.ownerId,
      userId: auth.userId,
      role: auth.role,
      membershipRole: auth.membershipRole ?? null,
      isAdvisor: auth.isAdvisor ?? false,
      isActive: auth.isActive,
    });
  }

  static capabilities(project: Project, auth: AuthContext): ProjectCapabilities {
    return capabilitiesFor(this.level(project, auth));
  }

  static canRead(project: Project, auth: AuthContext): boolean {
    return this.capabilities(project, auth).canRead;
  }

  static canWrite(project: Project, auth: AuthContext): boolean {
    return this.capabilities(project, auth).canEdit;
  }

  static canDelete(project: Project, auth: AuthContext): boolean {
    return this.capabilities(project, auth).canDelete;
  }

  static canCompileOfficial(project: Project, auth: AuthContext): boolean {
    return this.capabilities(project, auth).canCompileOfficial;
  }

  static canManageSettings(project: Project, auth: AuthContext): boolean {
    return this.capabilities(project, auth).canManageSettings;
  }
}
