/**
 * Template Domain Types
 * 
 * Pure domain types for Template entities - no framework dependencies.
 */

/**
 * Template category enumeration
 */
export enum TemplateCategory {
  Thesis = 'thesis',
  Report = 'report',
  Proposal = 'proposal',
  Paper = 'paper',
  Presentation = 'presentation',
  Other = 'other',
}

/**
 * Template entity
 */
export type Template = {
  id: string;
  name: string;
  description: string | null;
  category: TemplateCategory;
  isOfficial: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  /**
   * Editable "source project" (admin-owned working copy) this template is
   * authored from. `null` when the template has no source project yet.
   * Optional so existing constructions (tests, seeds) don't need updating;
   * the Prisma repo always populates it.
   */
  sourceProjectId?: string | null;
};

/**
 * TemplateVersion entity
 */
export type TemplateVersion = {
  id: string;
  templateId: string;
  versionNumber: string;
  changelog: string | null;
  storageKey: string;
  entryPath: string;
  isActive: boolean;
  createdAt: Date;
};

/**
 * Template with latest version info (for public listing)
 */
export type TemplateWithLatestVersion = Template & {
  latestVersion: {
    id: string;
    versionNumber: string;
    createdAt: Date;
  } | null;
};

/**
 * Data required to create a new Template
 */
export type CreateTemplateData = {
  name: string;
  description: string | null;
  category: TemplateCategory;
  isOfficial: boolean;
};

/**
 * Data that can be updated for an existing Template
 */
export type UpdateTemplateData = {
  name?: string;
  description?: string | null;
  category?: TemplateCategory;
  isOfficial?: boolean;
  isActive?: boolean;
};

/**
 * Filter for listing templates (admin)
 */
export type TemplateFilter = {
  search?: string;
  category?: TemplateCategory;
  isOfficial?: boolean;
  isActive?: boolean;
  page: number;
  pageSize: number;
};

/**
 * Data required to create a new TemplateVersion
 */
export type CreateVersionData = {
  templateId: string;
  versionNumber: string;
  changelog: string | null;
  storageKey: string;
  entryPath: string;
};

/**
 * Materialized file from template version
 */
export type MaterializedFile = {
  path: string;
  content: string;
};
