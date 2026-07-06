
import type { Project } from './Types.js';

export type ProjectAccessLevel =
  | 'owner'
  | 'editor'
  | 'viewer'
  | 'advisor'
  | 'adminOversight'
  | 'none';

export interface AuthContext {
  userId: string;
  role: 'admin' | 'teacher' | 'student';
  membershipRole?: 'editor' | 'viewer' | null;
  isAdvisor?: boolean;
}

export interface AccessResolutionInput {
  ownerId: string | null;
  userId: string;
  role: 'admin' | 'teacher' | 'student';
  membershipRole?: 'editor' | 'viewer' | null;
  isAdvisor?: boolean;
}

export function resolveProjectAccess(input: AccessResolutionInput): ProjectAccessLevel {
  if (input.ownerId !== null && input.ownerId === input.userId) {
    return 'owner';
  }
  if (input.membershipRole === 'editor') {
    return 'editor';
  }
  if (input.isAdvisor === true) {
    return 'advisor';
  }
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
}

const READ_LEVELS: ReadonlySet<ProjectAccessLevel> = new Set([
  'owner',
  'editor',
  'viewer',
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
  return {
    level,
    canRead,
    canEdit: canWrite,
    canDelete: level === 'owner',
    canManageSettings: canWrite,
    canCompileOfficial: canWrite,
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
