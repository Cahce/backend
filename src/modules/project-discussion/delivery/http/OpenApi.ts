import { z } from 'zod';
import { documentOperation, commonErrorResponses, conflictResponse, type OperationContract } from '../../../../shared/http/OpenApi.js';
import { pageSchema, commentPageSchema, messageSchema, threadSchema, replySchema, revisionSchema, editThreadSchema, editCommentSchema,
  readSchema, eventsSchema, messageResponseSchema, commentResponseSchema, threadResponseSchema, readStateResponseSchema, eventResponseSchema, ticketResponseSchema } from './Dto.js';
const projectParams = z.object({ projectId: z.string() });
const threadParams = projectParams.extend({ threadId: z.string() });
const commentParams = projectParams.extend({ commentId: z.string() });
const cursor = z.string().nullable();
const sequence = readSchema.shape.lastReadMessageSeq;
const message = z.object({ message: messageResponseSchema, created: z.boolean() }).strict();
const thread = z.object({ thread: threadResponseSchema }).strict();
const comment = z.object({ comment: commentResponseSchema }).strict();
const access = 'Cần quyền đọc thảo luận (canReadChat); admin giám sát không tự được tham gia. ';
function operation(operationId: string, summary: string, description: string,
  fields: Omit<OperationContract, 'operationId' | 'summary' | 'description' | 'tag'>) {
  return documentOperation({ ...fields, operationId, summary, description: access + description, tag: 'project-discussion',
    responses: { ...commonErrorResponses, ...fields.responses } });
}
export const discussionDocumentation = {
  history: operation('getProjectChatHistory', 'Lịch sử chat', 'before là sequence của tin nhắn; trang sắp seq giảm dần. Tin đã xóa giữ tombstone body=null. highWatermark là mốc event log, không phải số lượng tin nhắn.', {
    params: projectParams, query: pageSchema, responses: { 200: { description: 'Trang lịch sử chat.', schema: z.object({ messages: z.array(messageResponseSchema), nextCursor: cursor, highWatermark: sequence }).strict() } },
  }),
  send: operation('sendProjectChatMessage', 'Gửi tin nhắn', 'Cần canSendChat. clientMessageId UUID dùng lại khi retry cùng nội dung; key đã dùng với nội dung khác trả 409. Tombstone không được phục hồi khi retry.', {
    params: projectParams, body: messageSchema.meta({ example: { clientMessageId: '11111111-1111-4111-8111-111111111111', body: 'Mời mọi người nhận xét bố cục chương 1.' } }), responses: { 201: { description: 'Tin mới, created=true.', schema: message }, 200: { description: 'Retry idempotent, created=false.', schema: message }, 409: conflictResponse },
  }),
  deleteMessage: operation('deleteProjectChatMessage', 'Xóa tin nhắn', 'Tác giả hoặc canModerateDiscussion; giữ tombstone, gọi lại không tạo tin mới.', {
    params: projectParams.extend({ messageId: z.string() }), responses: { 204: { description: 'Đã xóa, không có response body.' } },
  }),
  readState: operation('getProjectChatReadState', 'Mốc đã đọc và số tin chưa đọc', 'Mốc tăng đơn điệu; unread không tính tin tự gửi hoặc đã xóa.', {
    params: projectParams, responses: { 200: { description: 'Read-state của người gọi.', schema: readStateResponseSchema } },
  }),
  markRead: operation('markProjectChatRead', 'Cập nhật mốc đã đọc', 'Không hạ mốc khi nhiều tab ghi ngược thứ tự. Không nhận sequence vượt event head. Số nguyên 64 bit truyền dưới dạng chuỗi thập phân.', {
    params: projectParams, body: readSchema, responses: { 200: { description: 'Read-state sau cập nhật.', schema: readStateResponseSchema } },
  }),
  threads: operation('listProjectCommentThreads', 'Danh sách cuộc nhận xét', 'before là ID thread dùng để tìm cặp cursor createdAt/id; sắp cặp này giảm dần. Bao gồm tombstones và trang đầu replies; xem commentsNextCursor để tải thêm.', {
    params: projectParams, query: commentPageSchema.pick({ before: true, limit: true }), responses: { 200: { description: 'Trang thread.', schema: z.object({ threads: z.array(threadResponseSchema), highWatermark: sequence, nextCursor: cursor }).strict() } },
  }),
  replies: operation('listProjectCommentReplies', 'Tải trả lời nhận xét', 'after là ID comment dùng để tìm cặp cursor createdAt/id; sắp cặp này tăng dần. HTTP default limit=25, tối đa 50.', {
    params: threadParams, query: commentPageSchema.pick({ after: true, limit: true }), responses: { 200: { description: 'Trang trả lời.', schema: z.object({ comments: z.array(commentResponseSchema), nextCursor: cursor }).strict() } },
  }),
  createThread: operation('createProjectCommentThread', 'Thêm cuộc nhận xét', 'Cần canComment. anchor là project/file/range; range dùng offset UTF-16 [from,to), quote khớp bản đã lưu, baseRevision khớp tệp; không tách surrogate pair. Không sửa source. clientCommentId dùng lại cho retry cùng nội dung/anchor.', {
    params: projectParams, body: threadSchema, responses: { 201: { description: 'Thread mới hoặc kết quả retry idempotent.', schema: thread }, 409: conflictResponse },
  }),
  reply: operation('replyToProjectCommentThread', 'Trả lời nhận xét', 'Cần canComment, thread còn mở. UUID dùng lại cho retry; thread đã xử lý hoặc key khác nội dung trả 409.', {
    params: threadParams, body: replySchema, responses: { 201: { description: 'Comment mới hoặc kết quả retry.', schema: comment }, 409: conflictResponse },
  }),
  changeThread: operation('changeProjectCommentThread', 'Đóng hoặc mở lại nhận xét', 'Tác giả có canComment, editor, hoặc canModerateDiscussion. baseRevision phải khớp.', {
    params: threadParams, body: editThreadSchema, responses: { 200: { description: 'Thread sau thay đổi.', schema: thread }, 409: conflictResponse },
  }),
  deleteThread: operation('deleteProjectCommentThread', 'Xóa cuộc nhận xét', 'Tác giả có canComment hoặc canModerateDiscussion. DELETE có JSON body baseRevision; trả tombstone thread và comments, không phải 204.', {
    params: threadParams, body: revisionSchema, responses: { 200: { description: 'Thread đã xóa.', schema: thread }, 409: conflictResponse },
  }),
  editComment: operation('editProjectComment', 'Sửa nhận xét', 'Cần canComment và là tác giả hoặc moderator. baseRevision phải khớp; thread phải tồn tại và chưa bị xóa.', {
    params: commentParams, body: editCommentSchema, responses: { 200: { description: 'Comment sau thay đổi.', schema: comment }, 409: conflictResponse },
  }),
  deleteComment: operation('deleteProjectComment', 'Xóa nhận xét', 'Cần canComment và là tác giả hoặc moderator. DELETE có body baseRevision; trả comment tombstone body=null, không phải 204.', {
    params: commentParams, body: revisionSchema, responses: { 200: { description: 'Comment đã xóa.', schema: comment }, 409: conflictResponse },
  }),
  events: operation('replayProjectEvents', 'Đọc lại sự kiện project', 'since là event cursor, sắp seq tăng dần. nextCursor/highWatermark là chuỗi decimal; khi hasMore=true tiếp tục đọc. Payload được hydrate theo trạng thái hiện hành, gồm tombstones. Không hứa retention/410.', {
    params: projectParams, query: eventsSchema, responses: { 200: { description: 'Trang sự kiện.', schema: z.object({ events: z.array(eventResponseSchema), nextCursor: sequence, highWatermark: sequence, hasMore: z.boolean() }).strict() } },
  }),
  ticket: operation('createProjectRealtimeTicket', 'Cấp ticket WebSocket một lần', 'Ticket hiệu lực tối đa 30 giây và không vượt hạn JWT. Gửi trong frame authenticate {type,ticket,since} tới /api/v1/projects/:projectId/realtime (WebSocket); Origin phải được cho phép. Không gửi ticket qua URL. Quyền/session được kiểm tra lại; WS không phải API sửa source.', {
    params: projectParams, responses: { 200: { description: 'Ticket bí mật dùng một lần và hạn ISO.', schema: ticketResponseSchema } },
  }),
};
