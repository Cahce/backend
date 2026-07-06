
import type { PrismaClient } from "../../../generated/prisma/index.js";
import type {
    ProjectAccessPolicy,
    ProjectWriteAccessPolicy,
} from "../domain/access/ProjectAccessPolicies.js";

export class PrismaProjectAccessRepository
    implements ProjectAccessPolicy, ProjectWriteAccessPolicy
{
    constructor(private readonly prisma: PrismaClient) {}

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
