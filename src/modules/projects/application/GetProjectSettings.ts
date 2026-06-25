import type { ProjectSettingsRepository } from "../domain/ProjectSettingsRepository.js";
import type { ProjectSettings } from "../domain/ProjectSettings.js";
import type { ProjectRepo } from "../domain/Project/Ports.js";
import { ProjectAuthPolicy } from "../domain/Project/Policies.js";
import { buildProjectAuthContext } from "./ProjectAuthContext.js";
import { ProjectErrors } from "../domain/Project/Errors.js";

export interface GetProjectSettingsCommand {
    projectId: string;
    userId: string;
    userRole: "admin" | "teacher" | "student";
}

export class GetProjectSettings {
    constructor(
        private readonly settingsRepo: ProjectSettingsRepository,
        private readonly projectRepo: ProjectRepo,
    ) {}

    async execute(cmd: GetProjectSettingsCommand): Promise<ProjectSettings> {
        // Check if project exists and user has access
        const project = await this.projectRepo.findById(cmd.projectId);
        if (!project) {
            throw new Error(ProjectErrors.PROJECT_NOT_FOUND.code);
        }

        // Resolve ProjectMember / advisor relations so collaborators and
        // advisors are not wrongly denied (inline AuthContext left these undefined).
        const authContext = await buildProjectAuthContext(
            this.projectRepo,
            project,
            cmd.userId,
            cmd.userRole,
        );

        if (!ProjectAuthPolicy.canRead(project, authContext)) {
            throw new Error(ProjectErrors.UNAUTHORIZED.code);
        }

        // Find or create settings
        return await this.settingsRepo.findOrCreate(cmd.projectId);
    }
}
