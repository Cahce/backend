
export enum TemplateCategory {
  Thesis = 'thesis',
  Project = 'project',
  Report = 'report',
  Proposal = 'proposal',
  Paper = 'paper',
  Presentation = 'presentation',
  Other = 'other',
}

export type Project = {
  id: string;
  title: string;
  category: TemplateCategory;
  ownerId: string | null;
  templateId: string | null;
  templateVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastEditedAt: Date | null;
};

export type CreateProjectData = {
  title: string;
  category: TemplateCategory;
  ownerId: string;
  templateId?: string | null;
  templateVersionId?: string | null;
};

export type UpdateProjectData = {
  projectId: string;
  title?: string;
  category?: TemplateCategory;
};
