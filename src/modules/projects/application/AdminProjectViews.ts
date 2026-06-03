/**
 * Admin project view DTOs (application output) + pure mappers.
 *
 * These are the JSON-ready shapes (ISO strings) returned by the admin
 * oversight use cases. The delivery layer's Zod response schemas mirror these
 * structurally — same pattern as domain `Project` ↔ `ProjectResponseSchema`.
 */

import type {
  AdminProjectRow,
  AdminProjectDetailRow,
  AdminProjectOwnerView,
  AdminProjectStats,
  AdminProjectCategory,
} from '../domain/Project/AdminProjectPorts.js';

export interface AdminProjectOwnerDto {
  userId: string;
  email: string;
  role: 'admin' | 'student' | 'teacher';
  isActive: boolean;
  displayName: string | null;
  code: string | null;
  faculty: { id: string; name: string; code: string } | null;
  unit: string | null;
}

export interface AdminProjectListItemDto {
  id: string;
  title: string;
  category: AdminProjectCategory;
  createdAt: string;
  updatedAt: string;
  lastEditedAt: string | null;
  fileCount: number;
  hasPdf: boolean;
  owner: AdminProjectOwnerDto | null;
}

export interface AdminProjectListDto {
  items: AdminProjectListItemDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AdminProjectFileDto {
  path: string;
  kind: string;
  sizeBytes: number | null;
  updatedAt: string;
}

export interface AdminProjectDetailDto extends AdminProjectListItemDto {
  mainPath: string | null;
  totalSizeBytes: number;
  latestArtifact: { id: string; createdAt: string; sizeBytes: number | null } | null;
  files: AdminProjectFileDto[];
}

export interface AdminProjectStatsDto {
  total: number;
  byRole: { student: number; teacher: number };
  byCategory: Record<AdminProjectCategory, number>;
}

function mapOwner(owner: AdminProjectOwnerView | null): AdminProjectOwnerDto | null {
  return owner;
}

export function toListItemDto(row: AdminProjectRow): AdminProjectListItemDto {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastEditedAt: row.lastEditedAt ? row.lastEditedAt.toISOString() : null,
    fileCount: row.fileCount,
    hasPdf: row.hasPdf,
    owner: mapOwner(row.owner),
  };
}

export function toDetailDto(row: AdminProjectDetailRow): AdminProjectDetailDto {
  return {
    ...toListItemDto(row),
    mainPath: row.mainPath,
    totalSizeBytes: row.totalSizeBytes,
    latestArtifact: row.latestArtifact
      ? {
          id: row.latestArtifact.id,
          createdAt: row.latestArtifact.createdAt.toISOString(),
          sizeBytes: row.latestArtifact.sizeBytes,
        }
      : null,
    files: row.files.map((f) => ({
      path: f.path,
      kind: f.kind,
      sizeBytes: f.sizeBytes,
      updatedAt: f.updatedAt.toISOString(),
    })),
  };
}

export function toStatsDto(stats: AdminProjectStats): AdminProjectStatsDto {
  return stats;
}
