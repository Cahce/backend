/**
 * Admin Project Oversight Ports
 *
 * Read-only domain port for the admin "project oversight" feature. Kept
 * separate from {@link ProjectRepo} (which stays owner-scoped) so that the
 * existing CRUD flows are untouched. No framework dependencies.
 *
 * The repo returns plain "row" view types with `Date` values; application use
 * cases map them to the HTTP DTO (ISO strings). See
 * `.kiro/specs/admin-project-oversight-backend/design.md`.
 */

/** Owner roles an admin can filter projects by. */
export type ProjectOwnerRole = 'student' | 'teacher';

/**
 * Project category, as the string-literal union actually persisted by Prisma.
 * Decoupled from the {@link TemplateCategory} enum so the read model and its
 * JSON `Record` keys serialize cleanly.
 */
export type AdminProjectCategory =
  | 'thesis'
  | 'report'
  | 'proposal'
  | 'paper'
  | 'presentation'
  | 'other';

export const ADMIN_PROJECT_CATEGORIES: readonly AdminProjectCategory[] = [
  'thesis',
  'report',
  'proposal',
  'paper',
  'presentation',
  'other',
];

/** Filters/sort/pagination for the admin project list (already parsed). */
export interface AdminProjectFilters {
  ownerRole?: ProjectOwnerRole;
  category?: AdminProjectCategory;
  search?: string;
  facultyId?: string;
  /** Student owners only: filter by their class. */
  classId?: string;
  /** Student owners only: filter by their major. */
  majorId?: string;
  /** Teacher owners only: filter by their department. */
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

/** Whitelisted owner projection (never exposes passwordHash etc.). */
export interface AdminProjectOwnerView {
  userId: string;
  email: string;
  role: 'admin' | 'student' | 'teacher';
  isActive: boolean;
  /** Student/teacher full name; null for orphan or profile-less accounts. */
  displayName: string | null;
  /** studentCode | teacherCode | null. */
  code: string | null;
  faculty: { id: string; name: string; code: string } | null;
  /** student: "Lớp <class> · <major>"; teacher: "<department>". */
  unit: string | null;
}

/** One row in the admin project list. */
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

/** Compact file entry for the admin detail view. */
export interface AdminProjectFileRow {
  path: string;
  kind: string;
  sizeBytes: number | null;
  updatedAt: Date;
}

/** Detail row = list row + extra project internals. */
export interface AdminProjectDetailRow extends AdminProjectRow {
  mainPath: string | null;
  totalSizeBytes: number;
  latestArtifact: { id: string; createdAt: Date; sizeBytes: number | null } | null;
  files: AdminProjectFileRow[];
}

/** Aggregate counts for the stats cards. */
export interface AdminProjectStats {
  total: number;
  byRole: { student: number; teacher: number };
  byCategory: Record<AdminProjectCategory, number>;
}

export interface AdminProjectListResult {
  items: AdminProjectRow[];
  total: number;
}

/**
 * Read-only repository for admin project oversight.
 * Infra (`AdminProjectRepoPrisma`) provides the concrete implementation.
 */
export interface AdminProjectRepo {
  /** List projects across all owners with filters + pagination. */
  listForAdmin(filters: AdminProjectFilters): Promise<AdminProjectListResult>;
  /** Project detail with owner context + file summary, or null if missing. */
  getDetailForAdmin(projectId: string): Promise<AdminProjectDetailRow | null>;
  /** Aggregate counts; optional ownerRole scopes `total`/`byCategory`. */
  stats(ownerRole?: ProjectOwnerRole): Promise<AdminProjectStats>;
}
