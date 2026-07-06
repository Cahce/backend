
import type { ProjectRepo } from '../domain/Project/Ports.js';
import type { Project } from '../domain/Project/Types.js';
import type { AuthContext } from '../domain/Project/Policies.js';

export async function buildProjectAuthContext(
  projectRepo: ProjectRepo,
  project: Project,
  userId: string,
  role: 'admin' | 'teacher' | 'student',
): Promise<AuthContext> {
  if (project.ownerId !== null && project.ownerId === userId) {
    return { userId, role };
  }

  const { membershipRole, isAdvisor } = await projectRepo.getEffectiveAccess(
    project.id,
    userId,
  );
  return { userId, role, membershipRole, isAdvisor };
}
