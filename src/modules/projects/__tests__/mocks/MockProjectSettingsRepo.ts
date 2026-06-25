/**
 * Mock Project Settings Repository for Unit Testing
 * 
 * Test double that implements ProjectSettingsRepository interface for isolated testing.
 */

import type { ProjectSettingsRepository } from '../../domain/ProjectSettingsRepository.js';
import { ProjectSettings } from '../../domain/ProjectSettings.js';

/**
 * Mock implementation of ProjectSettingsRepository for unit tests
 */
export class MockProjectSettingsRepo implements ProjectSettingsRepository {
  private settings: Map<string, ProjectSettings> = new Map();

  /**
   * Configure mock to return specific settings
   */
  setSettings(projectId: string, settings: ProjectSettings): void {
    this.settings.set(projectId, settings);
  }

  /**
   * Clear all mock data
   */
  clear(): void {
    this.settings.clear();
  }

  async findOrCreate(projectId: string): Promise<ProjectSettings> {
    const existing = this.settings.get(projectId);
    if (existing) {
      return existing;
    }

    // Create default settings
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

  /**
   * Get settings for testing assertions
   */
  getSettings(projectId: string): ProjectSettings | undefined {
    return this.settings.get(projectId);
  }
}
