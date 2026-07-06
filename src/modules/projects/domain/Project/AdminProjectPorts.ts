
export type ProjectOwnerRole = 'student' | 'teacher';

export type AdminProjectCategory =
  | 'thesis'
  | 'project'
  | 'report'
  | 'proposal'
  | 'paper'
  | 'presentation'
  | 'other';

export const ADMIN_PROJECT_CATEGORIES: readonly AdminProjectCategory[] = [
  'thesis',
  'project',
  'report',
  'proposal',
  'paper',
  'presentation',
  'other',
];

export interface AdminProjectFilters {
  ownerRole?: ProjectOwnerRole;
  category?: AdminProjectCategory;
  search?: string;
  facultyId?: string;
  classId?: string;
  majorId?: string;
  departmentId?: string;
  createdFrom?: Date;
  createdTo?: Date;
  updatedFrom?: Date;
  updatedTo?: Date;
  sort: 'updatedAt' | 'createdAt' | 'title';
  order: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface AdminProjectOwnerView {
  userId: string;
  email: string;
  role: 'admin' | 'student' | 'teacher';
  isActive: boolean;
  displayName: string | null;
  code: string | null;
  faculty: { id: string; name: string; code: string } | null;
  unit: string | null;
}

export interface AdminProjectRow {
  id: string;
  title: string;
  category: AdminProjectCategory;
  createdAt: Date;
  updatedAt: Date;
  lastEditedAt: Date | null;
  fileCount: number;
  hasPdf: boolean;
  owner: AdminProjectOwnerView | null;
}

export interface AdminProjectFileRow {
  path: string;
  kind: string;
  sizeBytes: number | null;
  updatedAt: Date;
}

export interface AdminProjectDetailRow extends AdminProjectRow {
  mainPath: string | null;
  totalSizeBytes: number;
  latestArtifact: { id: string; createdAt: Date; sizeBytes: number | null } | null;
  files: AdminProjectFileRow[];
}

export interface AdminProjectStats {
  total: number;
  byRole: { student: number; teacher: number };
  byCategory: Record<AdminProjectCategory, number>;
}

export interface AdminProjectListResult {
  items: AdminProjectRow[];
  total: number;
}

export interface AdminProjectRepo {
  listForAdmin(filters: AdminProjectFilters): Promise<AdminProjectListResult>;
  getDetailForAdmin(projectId: string): Promise<AdminProjectDetailRow | null>;
  stats(ownerRole?: ProjectOwnerRole): Promise<AdminProjectStats>;
}
