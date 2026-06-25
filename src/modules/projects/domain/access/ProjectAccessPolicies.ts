/**
 * Project access policy ports (cross-cutting).
 *
 * These interfaces describe "who may read / write a project's content". They are
 * owned by the projects bounded context (the authority on project access) and
 * consumed by sibling modules that operate on project content — compile,
 * project-files (binary upload), zotero, openalex, capture, and zip portability.
 *
 * They were previously defined in `compile/domain/Policies.ts`, which made
 * compile the de-facto home for a policy unrelated to compilation. They now live
 * here so consumers depend on the owning module's published port instead.
 *
 * Pure interfaces — no framework dependencies. The concrete Prisma-backed
 * implementation lives in `projects/infra/PrismaProjectAccessRepository.ts`.
 */

/**
 * Read-level project access (owner or any member).
 *
 * Used to guard viewing compile jobs/artifacts, reading bibliography, etc.
 */
export interface ProjectAccessPolicy {
  /**
   * Check if user can READ a project (view compile jobs / artifacts).
   * Throws (`PROJECT_NOT_FOUND` / `PROJECT_ACCESS_DENIED`) if access is denied.
   */
  requireProjectAccess(projectId: string, userId: string): Promise<void>;
}

/**
 * Write-level project access (owner or editor member only).
 *
 * Used by content-mutating surfaces outside the projects module — binary upload,
 * zotero/openalex bibliography writes, web capture — so viewer-members and admin
 * oversight cannot mutate project content. Separate from {@link ProjectAccessPolicy}
 * (read: owner or any member) so read implementations are not forced to change.
 */
export interface ProjectWriteAccessPolicy {
  /**
   * Check if user may WRITE project content (owner or editor member only).
   * Throws (`PROJECT_NOT_FOUND` / `PROJECT_ACCESS_DENIED`) if access is denied.
   */
  requireWriteAccess(projectId: string, userId: string): Promise<void>;
}
