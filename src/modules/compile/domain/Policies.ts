/**
 * Compile module policies.
 *
 * The cross-cutting project read/write access ports now live in
 * `projects/domain/access/ProjectAccessPolicies.ts` (their natural owner).
 * Only the compile-specific official-compile access policy remains here.
 */

/**
 * Official (backend) compile/export access.
 *
 * Separate from the shared read policy (`ProjectAccessPolicy`, used by binary
 * upload / zotero / openalex / zip) so that shared read implementations are not
 * forced to know about official compile. Only the compile module implements this.
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
