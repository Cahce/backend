/**
 * Mock Template Repository for Unit Testing
 * 
 * Test double that implements TemplateRepo interface for isolated testing.
 */

import type { TemplateRepo } from '../../domain/Ports.js';
import type {
  Template,
  TemplateVersion,
  TemplateWithLatestVersion,
  CreateTemplateData,
  UpdateTemplateData,
  TemplateFilter,
  CreateVersionData,
} from '../../domain/Types.js';

/**
 * Mock implementation of TemplateRepo for unit tests
 */
export class MockTemplateRepo implements TemplateRepo {
  private templates: Map<string, Template> = new Map();
  private versions: Map<string, TemplateVersion> = new Map();
  private projectUsageCount: Map<string, number> = new Map();
  private nextId = 1;
  private nextVersionId = 1;

  /**
   * Configure mock to return specific templates
   */
  setTemplates(templates: Template[]): void {
    this.templates.clear();
    for (const template of templates) {
      this.templates.set(template.id, template);
    }
  }

  /**
   * Configure mock to return specific versions
   */
  setVersions(versions: TemplateVersion[]): void {
    this.versions.clear();
    for (const version of versions) {
      this.versions.set(version.id, version);
    }
  }

  /**
   * Configure mock project usage count
   */
  setProjectUsageCount(templateId: string, count: number): void {
    this.projectUsageCount.set(templateId, count);
  }

  /**
   * Clear all mock data
   */
  clear(): void {
    this.templates.clear();
    this.versions.clear();
    this.projectUsageCount.clear();
    this.nextId = 1;
    this.nextVersionId = 1;
  }

  async create(data: CreateTemplateData): Promise<Template> {
    const id = `template-${this.nextId++}`;
    const now = new Date();
    const template: Template = {
      id,
      name: data.name,
      description: data.description,
      category: data.category,
      isOfficial: data.isOfficial,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.templates.set(id, template);
    return template;
  }

  async findById(id: string): Promise<Template | null> {
    return this.templates.get(id) || null;
  }

  async list(filter: TemplateFilter): Promise<{ items: Template[]; total: number }> {
    let templates = Array.from(this.templates.values());

    // Apply filters
    if (filter.search) {
      const search = filter.search.toLowerCase();
      templates = templates.filter(
        (t) =>
          t.name.toLowerCase().includes(search) ||
          t.description?.toLowerCase().includes(search),
      );
    }

    if (filter.category) {
      templates = templates.filter((t) => t.category === filter.category);
    }

    if (filter.isOfficial !== undefined) {
      templates = templates.filter((t) => t.isOfficial === filter.isOfficial);
    }

    if (filter.isActive !== undefined) {
      templates = templates.filter((t) => t.isActive === filter.isActive);
    }

    const total = templates.length;

    // Apply pagination
    const start = (filter.page - 1) * filter.pageSize;
    const end = start + filter.pageSize;
    templates = templates.slice(start, end);

    return { items: templates, total };
  }

  async listPublic(): Promise<TemplateWithLatestVersion[]> {
    const activeTemplates = Array.from(this.templates.values()).filter((t) => t.isActive);

    const result: TemplateWithLatestVersion[] = [];

    for (const template of activeTemplates) {
      const versions = Array.from(this.versions.values())
        .filter((v) => v.templateId === template.id && v.isActive)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const latestVersion = versions[0]
        ? {
            id: versions[0].id,
            versionNumber: versions[0].versionNumber,
            createdAt: versions[0].createdAt,
          }
        : null;

      // Only include templates with at least one active version
      if (latestVersion) {
        result.push({
          ...template,
          latestVersion,
        });
      }
    }

    return result;
  }

  async update(id: string, data: UpdateTemplateData): Promise<Template> {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error('TEMPLATE_NOT_FOUND');
    }

    const updated: Template = {
      ...template,
      name: data.name !== undefined ? data.name : template.name,
      description: data.description !== undefined ? data.description : template.description,
      category: data.category !== undefined ? data.category : template.category,
      isOfficial: data.isOfficial !== undefined ? data.isOfficial : template.isOfficial,
      isActive: data.isActive !== undefined ? data.isActive : template.isActive,
      updatedAt: new Date(),
    };

    this.templates.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (!this.templates.has(id)) {
      throw new Error('TEMPLATE_NOT_FOUND');
    }
    this.templates.delete(id);
    // Also delete associated versions
    for (const [versionId, version] of this.versions.entries()) {
      if (version.templateId === id) {
        this.versions.delete(versionId);
      }
    }
  }

  async setSourceProject(templateId: string, projectId: string): Promise<void> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error('TEMPLATE_NOT_FOUND');
    }
    this.templates.set(templateId, { ...template, sourceProjectId: projectId });
  }

  async countProjectsUsing(templateId: string): Promise<number> {
    return this.projectUsageCount.get(templateId) || 0;
  }

  async countUsageByTemplateIds(
    templateIds: string[],
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    for (const id of templateIds) {
      const count = this.projectUsageCount.get(id);
      if (count !== undefined && count > 0) out.set(id, count);
    }
    return out;
  }

  async createVersion(data: CreateVersionData): Promise<TemplateVersion> {
    // Check if version already exists
    const existingVersion = Array.from(this.versions.values()).find(
      (v) => v.templateId === data.templateId && v.versionNumber === data.versionNumber,
    );

    if (existingVersion) {
      throw new Error('VERSION_EXISTS');
    }

    const id = `version-${this.nextVersionId++}`;
    const now = new Date();
    const version: TemplateVersion = {
      id,
      templateId: data.templateId,
      versionNumber: data.versionNumber,
      changelog: data.changelog,
      storageKey: data.storageKey,
      entryPath: data.entryPath,
      isActive: true,
      createdAt: now,
    };
    this.versions.set(id, version);
    return version;
  }

  async findVersionById(id: string): Promise<TemplateVersion | null> {
    return this.versions.get(id) || null;
  }

  async listVersions(templateId: string): Promise<TemplateVersion[]> {
    return Array.from(this.versions.values())
      .filter((v) => v.templateId === templateId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listVersionsByTemplate(templateId: string): Promise<TemplateVersion[]> {
    return this.listVersions(templateId);
  }

  async deactivateVersion(id: string): Promise<TemplateVersion> {
    const version = this.versions.get(id);
    if (!version) {
      throw new Error('VERSION_NOT_FOUND');
    }

    const updated: TemplateVersion = {
      ...version,
      isActive: false,
    };

    this.versions.set(id, updated);
    return updated;
  }

  async setVersionActive(versionId: string, isActive: boolean): Promise<TemplateVersion> {
    return this.updateVersion(versionId, { isActive });
  }

  async updateVersion(
    versionId: string,
    patch: { changelog?: string | null; isActive?: boolean },
  ): Promise<TemplateVersion> {
    const version = this.versions.get(versionId);
    if (!version) {
      throw new Error('VERSION_NOT_FOUND');
    }

    const updated: TemplateVersion = {
      ...version,
      changelog: patch.changelog !== undefined ? patch.changelog : version.changelog,
      isActive: patch.isActive !== undefined ? patch.isActive : version.isActive,
    };

    this.versions.set(versionId, updated);
    return updated;
  }
}
