import { z } from 'zod';
import type { ShareLinkRecord } from '../../../domain/sharing/Ports.js';
export const sharedRoleSchema = z.enum(['viewer', 'commenter', 'editor']);
export const sharingPageSchema = z.object({ before: z.string().min(1).max(100).optional(), limit: z.coerce.number().int().min(1).max(100).default(50) });
export const createShareSchema = z.object({ role: sharedRoleSchema, label: z.string().trim().max(80).optional(),
  expiresAt: z.iso.datetime().nullable() }).strict();
export const updateShareSchema = z.object({ baseVersion: z.number().int().positive(), role: sharedRoleSchema.optional(),
  label: z.string().trim().max(80).optional(), expiresAt: z.iso.datetime().nullable().optional() }).strict();
export const receiveShareSchema = z.object({ linkId: z.string().min(1).max(100), token: z.string().length(43) }).strict();
export const updateMemberSchema = z.object({ roleOverride: sharedRoleSchema.nullable().optional(),
  status: z.literal('active').optional() }).strict();
export function shareLinkDto(link: ShareLinkRecord) {
  return { id: link.id, projectId: link.projectId, label: link.label, role: link.role, version: link.version,
    expiresAt: link.expiresAt?.toISOString() ?? null, revokedAt: link.revokedAt?.toISOString() ?? null,
    createdAt: link.createdAt.toISOString(), updatedAt: link.updatedAt.toISOString() };
}

// JSON response contracts. Runtime handlers retain their existing mapping/serialization.
export const accessResponseSchema = z.object({
  level: z.enum(['owner', 'editor', 'commenter', 'viewer', 'advisor', 'adminOversight', 'none']),
  canRead: z.boolean(), canEdit: z.boolean(), canDelete: z.boolean(), canManageSettings: z.boolean(),
  canCompileOfficial: z.boolean(), canManageSharing: z.boolean(), canReadChat: z.boolean(), canSendChat: z.boolean(),
  canReadComments: z.boolean(), canComment: z.boolean(), canModerateDiscussion: z.boolean(),
  canExportProject: z.boolean(), canDuplicateProject: z.boolean(),
  version: z.string().regex(/^\d+$/).describe('Phiên bản quyền, chuỗi thập phân; không ép thành Number.'),
  validUntil: z.iso.datetime().nullable(),
}).strict();
export const shareLinkResponseSchema = z.object({
  id: z.string(), projectId: z.string(), role: sharedRoleSchema, label: z.string().nullable(),
  expiresAt: z.iso.datetime().nullable(), revokedAt: z.iso.datetime().nullable(),
  version: z.number().int().positive(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
}).strict();
export const memberUpdateResponseSchema = z.object({
  id: z.string(), projectId: z.string(), userId: z.string(), status: z.enum(['active', 'blocked', 'left']),
  roleOverride: sharedRoleSchema.nullable(), joinedAt: z.iso.datetime(), changedAt: z.iso.datetime(),
}).strict();
export const memberListItemSchema = memberUpdateResponseSchema.omit({ projectId: true, changedAt: true }).extend({
  displayName: z.string(), effectiveRole: sharedRoleSchema.nullable(),
});
export const shareResolutionSchema = z.object({
  project: z.object({ id: z.string(), title: z.string() }).strict(),
  owner: z.object({ id: z.string(), displayName: z.string() }).strict(),
  role: sharedRoleSchema, expiresAt: z.iso.datetime().nullable(),
}).strict();
