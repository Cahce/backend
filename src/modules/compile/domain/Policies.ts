/**
 * Compile module policies
 * 
 * Depends on existing projects access policy.
 */

export interface ProjectAccessPolicy {
  /**
   * Check if user can READ a project (view compile jobs / artifacts).
   * Throws error if access is denied.
   */
  requireProjectAccess(projectId: string, userId: string): Promise<void>;
}

/**
 * Separate from {@link ProjectAccessPolicy} so the shared read policy (used by
 * binary upload / zotero / openalex / zip) is not forced to know about official
 * compile. Only the compile module's own policy implements this.
 */
export interface OfficialCompileAccessPolicy {
  /**
   * Check if user may trigger an OFFICIAL (backend) compile/export for a project.
   * Requires write-level access (owner or editor member) — admins overseeing a
   * project they do not own, and viewers, are denied. Throws if access is denied.
   */
  requireOfficialCompileAccess(
    projectId: string,
    userId: string,
    userRole: 'admin' | 'teacher' | 'student',
  ): Promise<void>;
}

/**
 * Write-level project access (owner or editor member). Used by content-mutating
 * surfaces that live outside the projects module — binary upload, zotero/openalex
 * bibliography writes, web capture — so viewer-members and admin oversight cannot
 * mutate project content. Separate from {@link ProjectAccessPolicy} (read: owner
 * or any member) so the shared read implementations are not forced to change.
 */
export interface ProjectWriteAccessPolicy {
  /**
   * Check if user may WRITE project content (owner or editor member only).
   * Throws (`PROJECT_NOT_FOUND` / `PROJECT_ACCESS_DENIED`) if access is denied.
   */
  requireWriteAccess(projectId: string, userId: string): Promise<void>;
}
