/**
 * Project Domain Types
 * 
 * Pure domain types for Project entity - no framework dependencies.
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
 * Project entity representing a project container
 */
export type Project = {
  id: string;
  title: string;
  category: TemplateCategory;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastEditedAt: Date | null;
};

/**
 * Data required to create a new Project
 */
export type CreateProjectData = {
  title: string;
  category: TemplateCategory;
  ownerId: string;
};

/**
 * Data that can be updated for an existing Project
 */
export type UpdateProjectData = {
  projectId: string;
  title?: string;
  category?: TemplateCategory;
};
