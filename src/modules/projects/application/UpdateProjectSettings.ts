import type { ProjectSettingsRepository } from "../domain/ProjectSettingsRepository.js";
import type { ProjectSettings, CompileOptions, ZoteroConfig, OpenAlexConfig } from "../domain/ProjectSettings.js";
import type { ProjectRepo } from "../domain/Project/Ports.js";
import { ProjectAuthPolicy } from "../domain/Project/Policies.js";
import { buildProjectAuthContext } from "./ProjectAuthContext.js";
import { ProjectErrors } from "../domain/Project/Errors.js";
import type { FileRepo } from "../../project-files/domain/ProjectFile/Ports.js";

export interface UpdateProjectSettingsCommand {
    projectId: string;
    userId: string;
    userRole: "admin" | "teacher" | "student";
    patch: {
        mainPath?: string;
        compileOptions?: Partial<CompileOptions>;
        zoteroConfig?: ZoteroConfig;
        openalexConfig?: OpenAlexConfig;
    };
}

export class UpdateProjectSettings {
    constructor(
        private readonly settingsRepo: ProjectSettingsRepository,
        private readonly projectRepo: ProjectRepo,
        private readonly fileRepo: FileRepo,
    ) {}

    async execute(cmd: UpdateProjectSettingsCommand): Promise<ProjectSettings> {
        // Check if project exists and user has access
        const project = await this.projectRepo.findById(cmd.projectId);
        if (!project) {
            throw new Error(ProjectErrors.PROJECT_NOT_FOUND.code);
        }

        // Resolve ProjectMember / advisor relations so editor members can update
        // settings (inline AuthContext left membershipRole/isAdvisor undefined).
        const authContext = await buildProjectAuthContext(
            this.projectRepo,
            project,
            cmd.userId,
            cmd.userRole,
        );

        if (!ProjectAuthPolicy.canWrite(project, authContext)) {
            throw new Error(ProjectErrors.UNAUTHORIZED.code);
        }

        // Get current settings
        const current = await this.settingsRepo.findOrCreate(cmd.projectId);

        // Validate mainPath if provided
        if (cmd.patch.mainPath !== undefined) {
            this.validateMainPath(cmd.patch.mainPath);
            
            // Check if file exists
            const fileExists = await this.fileRepo.exists(cmd.projectId, cmd.patch.mainPath);
            if (!fileExists) {
                throw new Error("INVALID_MAIN_PATH");
            }
        }

        // Build updated settings
        const updated = new (current.constructor as typeof ProjectSettings)(
            current.projectId,
            cmd.patch.mainPath ?? current.mainPath,
            cmd.patch.compileOptions
                ? { ...current.compileOptions, ...cmd.patch.compileOptions }
                : current.compileOptions,
            cmd.patch.zoteroConfig !== undefined
                ? cmd.patch.zoteroConfig
                : current.zoteroConfig,
            cmd.patch.openalexConfig !== undefined
                ? cmd.patch.openalexConfig
                : current.openalexConfig,
            new Date(),
        );

        return await this.settingsRepo.update(updated);
    }

    private validateMainPath(path: string): void {
        // Check for path traversal
        if (path.startsWith("/") || path.includes("..")) {
            throw new Error("INVALID_MAIN_PATH");
        }

        // Check for empty path
        if (path.trim().length === 0) {
            throw new Error("INVALID_MAIN_PATH");
        }
    }
}
