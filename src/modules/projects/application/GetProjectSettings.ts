import type { ProjectSettingsRepository } from "../domain/ProjectSettingsRepository.js";
import type { ProjectSettings } from "../domain/ProjectSettings.js";
import type { ProjectRepo } from "../domain/Project/Ports.js";
import { ProjectAuthPolicy, type AuthContext } from "../domain/Project/Policies.js";
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

        const authContext: AuthContext = {
            userId: cmd.userId,
            role: cmd.userRole,
        };

        if (!ProjectAuthPolicy.canRead(project, authContext)) {
            throw new Error(ProjectErrors.UNAUTHORIZED.code);
        }

        // Find or create settings
        return await this.settingsRepo.findOrCreate(cmd.projectId);
    }
}
