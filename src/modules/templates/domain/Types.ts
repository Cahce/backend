
export enum TemplateCategory {
  Thesis = 'thesis',
  Project = 'project',
  Report = 'report',
  Proposal = 'proposal',
  Paper = 'paper',
  Presentation = 'presentation',
  Other = 'other',
}

export type Template = {
  id: string;
  name: string;
  description: string | null;
  category: TemplateCategory;
  isOfficial: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  sourceProjectId?: string | null;
};

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

export type TemplateWithLatestVersion = Template & {
  latestVersion: {
    id: string;
    versionNumber: string;
    createdAt: Date;
  } | null;
};

export type CreateTemplateData = {
  name: string;
  description: string | null;
  category: TemplateCategory;
  isOfficial: boolean;
};

export type UpdateTemplateData = {
  name?: string;
  description?: string | null;
  category?: TemplateCategory;
  isOfficial?: boolean;
  isActive?: boolean;
};

export type TemplateFilter = {
  search?: string;
  category?: TemplateCategory;
  isOfficial?: boolean;
  isActive?: boolean;
  page: number;
  pageSize: number;
};

export type CreateVersionData = {
  templateId: string;
  versionNumber: string;
  changelog: string | null;
  storageKey: string;
  entryPath: string;
};

export type MaterializedFile = {
  path: string;
  content: string;
  data?: Buffer;
};
