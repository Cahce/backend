import type { ProjectSettings } from "./ProjectSettings.js";

export interface ProjectSettingsRepository {
    /**
     * Find settings for a project, or create default if missing.
     * This ensures every project always has settings.
     */
    findOrCreate(projectId: string): Promise<ProjectSettings>;

    /**
     * Update settings for a project.
     */
    update(settings: ProjectSettings): Promise<ProjectSettings>;
}
