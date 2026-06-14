/**
 * Project Authorization Policy
 *
 * Domain-level authorization for Project operations. Pure — no framework deps.
 *
 * Single source of truth: every project / file / settings / compile access check
 * derives from {@link resolveProjectAccess} + {@link capabilitiesFor}. The resolver
 * already accepts membership/advisor inputs so `ProjectMember` (editor/viewer
 * collaborators) and `ProjectAdvisor` (teacher advisor read access) slot in without
 * a policy rewrite.
 *
 * Key rule: an admin who is NOT the owner gets `adminOversight` — READ ONLY.
 * Admins do not edit other users' document content; they oversee. (Admin-owned
 * template "source projects" pass the ordinary ownership check, so admins keep
 * full edit on those.)
 */

import type { Project } from './Types.js';

/**
 * Caller's effective relationship to a project, strongest first.
 * - `owner`          : `project.ownerId === userId`
 * - `editor`         : `ProjectMember.role === editor`        (Phase 2)
 * - `viewer`         : `ProjectMember.role === viewer`        (Phase 2)
 * - `advisor`        : assigned `ProjectAdvisor` teacher       (Phase 4)
 * - `adminOversight` : `role === admin` and not the owner — read-only oversight
 * - `none`           : no access
 */
export type ProjectAccessLevel =
  | 'owner'
  | 'editor'
  | 'viewer'
  | 'advisor'
  | 'adminOversight'
  | 'none';

/**
 * Authentication context containing user identity, role, and (optionally) the
 * caller's project-scoped relations. `membershipRole`/`isAdvisor` default to
 * "absent" so existing callers that only pass `{ userId, role }` keep working.
 */
export interface AuthContext {
  userId: string;
  role: 'admin' | 'teacher' | 'student';
  /** ProjectMember role for this project, if any (Phase 2). */
  membershipRole?: 'editor' | 'viewer' | null;
  /** True if the caller is an assigned advisor of this project (Phase 4). */
  isAdvisor?: boolean;
}

/** Inputs for the pure access resolver. */
export interface AccessResolutionInput {
  ownerId: string | null;
  userId: string;
  role: 'admin' | 'teacher' | 'student';
  membershipRole?: 'editor' | 'viewer' | null;
  isAdvisor?: boolean;
}

/**
 * Resolve the caller's access level for a project. Pure and deterministic.
 * Precedence: owner → editor → advisor → viewer → adminOversight → none.
 */
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

/** Capability flags derived from an access level. */
export interface ProjectCapabilities {
  level: ProjectAccessLevel;
  /** Read project + file content. */
  canRead: boolean;
  /** Write files and edit project metadata. */
  canEdit: boolean;
  /** Delete the project. */
  canDelete: boolean;
  /** Change project settings (main path, compile options, ...). */
  canManageSettings: boolean;
  /** Trigger backend (official) compile / export. */
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

/** Map an access level to its capability flags. */
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

/**
 * Project authorization policy facade.
 *
 * Thin wrappers over {@link resolveProjectAccess} + {@link capabilitiesFor} so
 * existing call sites keep their `(project, auth)` signature. The blanket
 * `role === 'admin'` allow that previously short-circuited write/delete has been
 * removed — admins now resolve to `adminOversight` (read-only) on projects they
 * do not own.
 */
export class ProjectAuthPolicy {
  /** Resolve the caller's access level for the given project. */
  static level(project: Project, auth: AuthContext): ProjectAccessLevel {
    return resolveProjectAccess({
      ownerId: project.ownerId,
      userId: auth.userId,
      role: auth.role,
      membershipRole: auth.membershipRole ?? null,
      isAdvisor: auth.isAdvisor ?? false,
    });
  }

  /** Full capability set for the caller on this project. */
  static capabilities(project: Project, auth: AuthContext): ProjectCapabilities {
    return capabilitiesFor(this.level(project, auth));
  }

  /** Read project metadata / file content. Includes admin oversight. */
  static canRead(project: Project, auth: AuthContext): boolean {
    return this.capabilities(project, auth).canRead;
  }

  /** Write files / edit project metadata. Owner or editor only (NOT admin). */
  static canWrite(project: Project, auth: AuthContext): boolean {
    return this.capabilities(project, auth).canEdit;
  }

  /** Delete the project. Owner only. */
  static canDelete(project: Project, auth: AuthContext): boolean {
    return this.capabilities(project, auth).canDelete;
  }

  /** Trigger backend official compile/export. Owner or editor only. */
  static canCompileOfficial(project: Project, auth: AuthContext): boolean {
    return this.capabilities(project, auth).canCompileOfficial;
  }

  /** Change project settings. Owner or editor only. */
  static canManageSettings(project: Project, auth: AuthContext): boolean {
    return this.capabilities(project, auth).canManageSettings;
  }
}
