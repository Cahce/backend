import type { ProjectSettings } from "./ProjectSettings.js";

export interface ProjectSettingsRepository {
    findOrCreate(projectId: string): Promise<ProjectSettings>;

    update(settings: ProjectSettings, options?: { actorId: string; baseRevision?: number; privateConfig?: boolean }): Promise<ProjectSettings>;
}
