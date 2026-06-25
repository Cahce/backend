/**
 * Prisma-backed implementation of the cross-cutting project-access policies.
 *
 * Implements both the READ policy (owner or any member) and the WRITE policy
 * (owner or editor member) so content-mutating surfaces — binary upload, Zotero,
 * OpenAlex, capture, zip export — deny viewer-members and admin oversight,
 * consistent with the projects-module ProjectAuthPolicy.
 *
 * This logic previously lived as an inline object literal in `app.ts` (the
 * composition root), which violated "no Prisma queries outside infra". It now
 * lives here behind the ProjectAccessPolicy / ProjectWriteAccessPolicy ports.
 */

import type { PrismaClient } from "../../../generated/prisma/index.js";
import type {
    ProjectAccessPolicy,
    ProjectWriteAccessPolicy,
} from "../domain/access/ProjectAccessPolicies.js";

export class PrismaProjectAccessRepository
    implements ProjectAccessPolicy, ProjectWriteAccessPolicy
{
    constructor(private readonly prisma: PrismaClient) {}

    /** READ: owner or any member. */
    async requireProjectAccess(projectId: string, userId: string): Promise<void> {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            include: { members: true },
        });

        if (!project) {
            throw new Error("PROJECT_NOT_FOUND");
        }

        const isOwner = project.ownerId === userId;
        const isMember = project.members.some((m) => m.userId === userId);

        if (!isOwner && !isMember) {
            throw new Error("PROJECT_ACCESS_DENIED");
        }
    }

    /** WRITE: owner or editor member only (viewers + admin oversight denied). */
    async requireWriteAccess(projectId: string, userId: string): Promise<void> {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            include: { members: { where: { userId } } },
        });

        if (!project) {
            throw new Error("PROJECT_NOT_FOUND");
        }

        const isOwner = project.ownerId === userId;
        const isEditor = project.members.some((m) => m.role === "editor");

        if (!isOwner && !isEditor) {
            throw new Error("PROJECT_ACCESS_DENIED");
        }
    }
}
