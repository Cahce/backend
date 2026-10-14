import { z } from 'zod';
const sequencePattern = /^(0|[1-9]\d{0,18})$/;
export const sequenceSchema = z.string().regex(sequencePattern).refine(value =>
  sequencePattern.test(value) && BigInt(value) <= 9223372036854775807n, 'Mốc vượt giới hạn');
export const pageSchema = z.object({ before: sequenceSchema.optional(), limit: z.coerce.number().int().min(1).max(100).default(50) });
export const commentPageSchema = z.object({ before: z.string().min(1).max(100).optional(), after: z.string().min(1).max(100).optional(), limit: z.coerce.number().int().min(1).max(50).default(25) });
const body = z.string().trim().min(1).max(4000);
export const messageSchema = z.object({ clientMessageId: z.string().uuid(), body }).strict();
const anchor = z.discriminatedUnion('kind', [z.object({ kind: z.literal('project') }).strict(),
  z.object({ kind: z.literal('file'), fileId: z.string().min(1).max(128) }).strict(),
  z.object({ kind: z.literal('range'), fileId: z.string().min(1).max(128), baseRevision: z.number().int().positive(),
    from: z.number().int().nonnegative(), to: z.number().int().positive(), quote: z.string().min(1).max(2000) }).strict()]);
export const threadSchema = z.object({ clientCommentId: z.string().uuid(), body, anchor }).strict();
export const replySchema = z.object({ clientCommentId: z.string().uuid(), body }).strict();
export const revisionSchema = z.object({ baseRevision: z.number().int().positive() }).strict();
export const editCommentSchema = revisionSchema.extend({ body });
export const editThreadSchema = revisionSchema.extend({ state: z.enum(['open', 'resolved']) });
export const readSchema = z.object({ lastReadMessageSeq: sequenceSchema }).strict();
export const eventsSchema = z.object({ since: sequenceSchema.default('0'), limit: z.coerce.number().int().min(1).max(200).default(100) });

export const authorResponseSchema = z.object({ id: z.string().nullable(), displayName: z.string() }).strict();
const decimalSequence = sequenceSchema.describe('Chuỗi số thập phân từ 0 đến 9223372036854775807; không ép thành Number.');
export const messageResponseSchema = z.object({
  id: z.string(), projectId: z.string(), seq: decimalSequence, clientMessageId: z.string().uuid(), author: authorResponseSchema,
  body: z.string().nullable(), createdAt: z.iso.datetime(), deletedAt: z.iso.datetime().nullable(),
}).strict();
export const commentResponseSchema = z.object({
  id: z.string(), threadId: z.string(), author: authorResponseSchema, body: z.string().nullable(),
  revision: z.number().int().positive(), clientCommentId: z.string().uuid(), createdAt: z.iso.datetime(), deletedAt: z.iso.datetime().nullable(),
}).strict();
export const threadResponseSchema = z.object({
  id: z.string(), projectId: z.string(), createdById: z.string().nullable(), clientCommentId: z.string().uuid(),
  anchor, anchorStatus: z.enum(['current', 'stale', 'file_deleted']), filePath: z.string().nullable(),
  state: z.enum(['open', 'resolved']), revision: z.number().int().positive(), deletedAt: z.iso.datetime().nullable(),
  comments: z.array(commentResponseSchema), commentsNextCursor: z.string().nullable(), updatedAt: z.iso.datetime(),
}).strict();
export const readStateResponseSchema = z.object({ lastReadMessageSeq: decimalSequence, unreadCount: z.number().int().nonnegative() }).strict();
export const eventResponseSchema = z.object({
  type: z.string(), projectId: z.string(), seq: decimalSequence, accessVersion: decimalSequence, occurredAt: z.iso.datetime(),
  data: z.record(z.string(), z.unknown()).describe('Payload phụ thuộc type: chat.message.* {message|null}; comment.thread.* {thread|null}; comment.reply.* {thread|null,comment|null}; chat.read.changed của người gọi có read-state, của người khác là {}; project.* có metadata để invalidation.'),
}).strict();
export const ticketResponseSchema = z.object({ ticket: z.string().length(43), expiresAt: z.iso.datetime() }).strict();
