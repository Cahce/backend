/**
 * Prisma-backed compile access policy.
 *
 * Implements the read policy (view compile jobs/artifacts: owner or any member)
 * and the official-compile gate (enqueue/export: owner or editor member; admin
 * oversight + viewers denied), reusing the projects-domain access resolver as the
 * single source of truth.
 *
 * Moved out of the compile composition root (Container.ts) so DB queries live in
 * infra, not in wiring code.
 */

import type { PrismaClient } from "../../../generated/prisma/index.js";
import type { ProjectAccessPolicy } from "../../projects/domain/access/ProjectAccessPolicies.js";
import type { OfficialCompileAccessPolicy } from "../domain/Policies.js";
import { CompileJobError } from "../domain/Errors.js";
import {
    resolveProjectAccess,
    capabilitiesFor,
} from "../../projects/domain/Project/Policies.js";

export class PrismaCompileAccessRepository
    implements ProjectAccessPolicy, OfficialCompileAccessPolicy
{
    constructor(private readonly prisma: PrismaClient) {}

    /** READ access (view compile jobs/artifacts): owner or any member. */
    async requireProjectAccess(projectId: string, userId: string): Promise<void> {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            include: {
                members: {
                    where: { userId },
                },
            },
        });

        if (!project) {
            throw new Error("PROJECT_NOT_FOUND");
        }

        if (project.ownerId !== userId && project.members.length === 0) {
            throw new Error("PROJECT_ACCESS_DENIED");
        }
    }

    /**
     * OFFICIAL compile/export: requires write-level access (owner or editor
     * member). Admin oversight (non-owner) and viewers are denied. Throws a
     * CompileJobError so the route maps it to a clean 403/404.
     */
    async requireOfficialCompileAccess(
        projectId: string,
        userId: string,
        userRole: "admin" | "teacher" | "student",
    ): Promise<void> {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            include: {
                members: {
                    where: { userId },
                    select: { role: true },
                },
            },
        });

        if (!project) {
            throw new CompileJobError("PROJECT_NOT_FOUND", "Không tìm thấy dự án");
        }

        const membershipRole = project.members[0]?.role ?? null;
        const level = resolveProjectAccess({
            ownerId: project.ownerId,
            userId,
            role: userRole,
            membershipRole,
        });

        if (!capabilitiesFor(level).canCompileOfficial) {
            throw new CompileJobError(
                "PROJECT_ACCESS_DENIED",
                "Bạn không có quyền biên dịch/xuất bản dự án này",
            );
        }
    }
}
