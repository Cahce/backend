import { z } from 'zod';
import { documentOperation, commonErrorResponses, apiErrorSchema } from '../../../../../shared/http/OpenApi.js';
import { updateProjectSettingsSchema, projectSettingsResponseSchema } from './Dto.js';

const params = z.object({ projectId: z.string() });
const response = z.object({ settings: projectSettingsResponseSchema }).strict();
// The existing Fastify validator accepts objects for private configs before Zod runs.
const body = updateProjectSettingsSchema.extend({
  baseRevision: z.number().int().positive().describe('revision từ settings đã đọc.'),
  zoteroConfig: z.record(z.string(), z.unknown()).optional().describe('Chỉ chủ project được cập nhật. Runtime hiện hành nhận object.'),
  openalexConfig: z.record(z.string(), z.unknown()).optional().describe('Chỉ chủ project được cập nhật. Runtime hiện hành nhận object.'),
});
export const projectSettingsDocumentation = {
  get: documentOperation({
    operationId: 'getProjectSettings', tag: 'project-settings', summary: 'Đọc thiết lập project', params,
    description: 'Yêu cầu quyền đọc. Trả {settings}, gồm revision để dùng làm baseRevision. Chỉ chủ project được thấy zoteroConfig/openalexConfig; người cộng tác hoặc giám sát nhận null cho hai trường này.',
    responses: { ...commonErrorResponses, 200: { description: 'Thiết lập project; cấu hình riêng được ẩn theo người gọi.', schema: response } },
  }),
  update: documentOperation({
    operationId: 'updateProjectSettings', tag: 'project-settings', summary: 'Cập nhật thiết lập project bằng revision', params, body,
    description: 'Yêu cầu canManageSettings. Gửi baseRevision bằng settings.revision đã đọc; thành công trả revision mới. mainPath phải tương đối, không chứa .. và trỏ tới tệp tồn tại. compileOptions.ppi là số nguyên72–600. Chỉ chủ project được đổi Zotero/OpenAlex config; response của người khác luôn ẩn hai config. Runtime Fastify hiện hành nhận object cho các config, kể cả khi Zod chấp nhận dữ liệu rộng hơn.',
    responses: {
      ...commonErrorResponses, 200: { description: 'Thiết lập đã lưu.', schema: response },
      409: { description: 'SETTINGS_VERSION_CONFLICT: revision đã thay đổi; tải lại và hợp nhất trước khi gửi lại.', schema: apiErrorSchema },
      428: { description: 'PRECONDITION_REQUIRED: thiếu baseRevision, tải lại thiết lập.', schema: apiErrorSchema },
    },
  }),
};
