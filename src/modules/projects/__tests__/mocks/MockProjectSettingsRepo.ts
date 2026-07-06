
import type { ProjectSettingsRepository } from '../../domain/ProjectSettingsRepository.js';
import { ProjectSettings } from '../../domain/ProjectSettings.js';

export class MockProjectSettingsRepo implements ProjectSettingsRepository {
  private settings: Map<string, ProjectSettings> = new Map();

  setSettings(projectId: string, settings: ProjectSettings): void {
    this.settings.set(projectId, settings);
  }

  clear(): void {
    this.settings.clear();
  }

  async findOrCreate(projectId: string): Promise<ProjectSettings> {
    const existing = this.settings.get(projectId);
    if (existing) {
      return existing;
    }

    const defaultSettings = new ProjectSettings(
      projectId,
      'main.typ',
      {},
      null,
      null,
      new Date(),
    );
    this.settings.set(projectId, defaultSettings);
    return defaultSettings;
  }

  async update(settings: ProjectSettings): Promise<ProjectSettings> {
    this.settings.set(settings.projectId, settings);
    return settings;
  }

  getSettings(projectId: string): ProjectSettings | undefined {
    return this.settings.get(projectId);
  }
}
