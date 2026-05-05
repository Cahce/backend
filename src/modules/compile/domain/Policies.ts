/**
 * Compile module policies
 * 
 * Depends on existing projects access policy.
 */

export interface ProjectAccessPolicy {
  /**
   * Check if user has access to a project
   * Throws error if access is denied
   */
  requireProjectAccess(projectId: string, userId: string): Promise<void>;
}
