import { z } from 'zod';
import { documentOperation, commonErrorResponses, conflictResponse, type OperationContract } from '../../../../../shared/http/OpenApi.js';
import { ProjectResponseSchema } from '../Project/Dto.js';
import { createShareSchema, updateShareSchema, receiveShareSchema, updateMemberSchema, sharingPageSchema,
  accessResponseSchema, shareLinkResponseSchema, memberListItemSchema, memberUpdateResponseSchema, shareResolutionSchema } from './Dto.js';

const projectParams = z.object({ projectId: z.string() });
const linkParams = projectParams.extend({ linkId: z.string() });
const memberParams = projectParams.extend({ memberId: z.string() });
const cursor = z.string().nullable();
const link = z.object({ link: shareLinkResponseSchema }).strict();
const createdLink = link.extend({ shareUrl: z.string().describe('URL tương đối /share/:id#token=…; mã chỉ trả khi tạo/đổi mã, lưu tại client trước khi đóng.') });
const owner = 'Chỉ chủ project (canManageSharing). Admin giám sát không tự có quyền quản lý link. ';
function operation(operationId: string, summary: string, description: string,
  fields: Omit<OperationContract, 'operationId' | 'summary' | 'description' | 'tag'>) {
  return documentOperation({ ...fields, operationId, summary, description, tag: 'project-sharing',
    responses: { ...commonErrorResponses, ...fields.responses } });
}
export const sharingDocumentation = {
  shared: operation('listSharedProjects', 'Danh sách project được chia sẻ',
    'Chỉ các project còn quyền qua membership. Cursor là ID membership (không phải projectId), sắp giảm dần; tiếp tục theo nextCursor dù trang có thể ít hơn limit.', {
      query: sharingPageSchema, responses: { 200: { description: 'Danh sách project và quyền hiện tại.', schema: z.object({
        projects: z.array(ProjectResponseSchema.omit({ access: true }).extend({ ownerDisplayName: z.string(), access: accessResponseSchema }).strict()), nextCursor: cursor,
      }).strict() } },
    }),
  access: operation('getProjectAccess', 'Quyền truy cập project', 'Cần canRead; trả capability hiện hành của chính người gọi.', {
    params: projectParams, responses: { 200: { description: 'Capability và phiên bản quyền.', schema: z.object({ access: accessResponseSchema }).strict() } },
  }),
  create: operation('createProjectShareLink', 'Tạo link chia sẻ', owner + 'Ba quyền viewer/commenter/editor. expiresAt bắt buộc: ISO tương lai hoặc null. Tối đa 20 link chưa thu hồi; tokenHash không trả ra ngoài.', {
    params: projectParams, body: createShareSchema.meta({ example: { role: 'viewer', label: 'Xem bản thảo', expiresAt: null } }), responses: { 201: { description: 'Link mới và URL dùng để mời.', schema: createdLink } },
  }),
  list: operation('listProjectShareLinks', 'Danh sách link chia sẻ', owner + 'Không trả token/URL có token. before là ID link, sắp ID giảm dần.', {
    params: projectParams, query: sharingPageSchema, responses: { 200: { description: 'Metadata link.', schema: z.object({ links: z.array(shareLinkResponseSchema), nextCursor: cursor }).strict() } },
  }),
  update: operation('updateProjectShareLink', 'Đổi quyền hoặc thời hạn link', owner + 'baseVersion phải khớp; link đã thu hồi không được sửa. Thời hạn quá khứ làm link hết hiệu lực.', {
    params: linkParams, body: updateShareSchema, responses: { 200: { description: 'Metadata link sau thay đổi.', schema: link }, 409: conflictResponse },
  }),
  rotate: operation('rotateProjectShareLink', 'Đổi mã link', owner + 'baseVersion phải khớp. Mã cũ không tham gia mới được; người đã tham gia giữ grant.', {
    params: linkParams, body: updateShareSchema.pick({ baseVersion: true }), responses: { 200: { description: 'URL với mã mới.', schema: createdLink }, 409: conflictResponse },
  }),
  revoke: operation('revokeProjectShareLink', 'Thu hồi link', owner + 'Idempotent. Grant phụ thuộc link này hết hiệu lực, không nhất thiết xóa quyền từ nguồn khác.', {
    params: linkParams, responses: { 204: { description: 'Đã thu hồi, không có response body.' } },
  }),
  resolve: operation('resolveProjectShare', 'Kiểm tra lời mời', 'Bắt buộc đăng nhập; không tự cấp quyền. Link sai, hết hạn, thu hồi hoặc không còn owner trả 404; thành viên bị chặn trả 403.', {
    body: receiveShareSchema, responses: { 200: { description: 'Thông tin lời mời tối thiểu.', schema: shareResolutionSchema } },
  }),
  redeem: operation('redeemProjectShare', 'Tham gia project bằng link', 'Bắt buộc đăng nhập; join idempotent. Quyền thực có thể khác role của link do override hoặc các grant khác. Người tham gia đọc được lịch sử và chat theo capability.', {
    body: receiveShareSchema, responses: { 200: { description: 'Project và quyền sau tham gia.', schema: z.object({ projectId: z.string(), access: accessResponseSchema }).strict() } },
  }),
  members: operation('listProjectMembers', 'Danh sách thành viên', owner + 'before là ID thành viên, sắp ID giảm dần; gồm displayName và effectiveRole.', {
    params: projectParams, query: sharingPageSchema, responses: { 200: { description: 'Danh sách thành viên.', schema: z.object({ members: z.array(memberListItemSchema), nextCursor: cursor }).strict() } },
  }),
  updateMember: operation('updateProjectMember', 'Đổi quyền riêng hoặc bỏ chặn', owner + 'roleOverride=null dùng quyền từ link. status=active bỏ chặn nhưng không khôi phục grant đã thu hồi. Response bản ghi không gồm displayName/effectiveRole; tải lại danh sách để lấy quyền hiệu lực.', {
    params: memberParams, body: updateMemberSchema, responses: { 200: { description: 'Bản ghi thành viên sau thay đổi.', schema: z.object({ member: memberUpdateResponseSchema }).strict() } },
  }),
  blockMember: operation('blockProjectMember', 'Chặn thành viên', owner + 'Thu hồi mọi grant; người bị chặn không thể tham gia bằng link khác.', {
    params: memberParams, responses: { 204: { description: 'Đã chặn, không có response body.' } },
  }),
  leave: operation('leaveSharedProject', 'Rời project được chia sẻ', 'Thành viên tự rời; thu hồi grant của chính mình. Chủ project không được rời.', {
    params: projectParams, responses: { 204: { description: 'Đã rời, không có response body.' } },
  }),
};
