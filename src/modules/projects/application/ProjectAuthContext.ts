/**
 * Build the AuthContext for project access checks.
 *
 * Resolves the caller's `ProjectMember` role and advisor status (via the repo)
 * so editor/viewer collaborators and teacher advisors get the correct access
 * level. The owner short-circuit avoids the extra lookup on the common path (a
 * user acting on their own project) and keeps owner behavior byte-for-byte
 * identical to before collaborator/advisor support existed.
 *
 * Shared by the `projects` and `project-files` use cases (both already depend on
 * the projects `ProjectRepo` port + `ProjectAuthPolicy`).
 */

import type { ProjectRepo } from '../domain/Project/Ports.js';
import type { Project } from '../domain/Project/Types.js';
import type { AuthContext } from '../domain/Project/Policies.js';

export async function buildProjectAuthContext(
  projectRepo: ProjectRepo,
  project: Project,
  userId: string,
  role: 'admin' | 'teacher' | 'student',
): Promise<AuthContext> {
  // Owner always wins — no need to look up membership/advisor.
  if (project.ownerId !== null && project.ownerId === userId) {
    return { userId, role };
  }

  const { membershipRole, isAdvisor } = await projectRepo.getEffectiveAccess(
    project.id,
    userId,
  );
  return { userId, role, membershipRole, isAdvisor };
}
