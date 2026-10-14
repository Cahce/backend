import { z } from 'zod';
import { documentOperation, commonErrorResponses, apiErrorSchema } from '../../../../../shared/http/OpenApi.js';
import { accessResponseSchema } from '../ProjectSharing/Dto.js';
import { CreateProjectRequestSchema, UpdateProjectRequestSchema, ImportProjectQuerySchema, PersistedProjectResponseSchema } from './Dto.js';

const params = z.object({ projectId: z.string().describe('ID project.') });
const precondition = { description: 'Thiếu baseRevision: PRECONDITION_REQUIRED. Tải lại project và giữ bản nháp.', schema: apiErrorSchema };
const conflict = { description: 'PROJECT_VERSION_CONFLICT: metadataRevision đã đổi; tải lại rồi hợp nhất thay đổi.', schema: apiErrorSchema };
export const projectDocumentation = {
  list: documentOperation({
    operationId: 'listOwnedProjects', tag: 'projects', summary: 'Danh sách project của tôi',
    description: 'Trả các project của người gọi theo updatedAt giảm dần, gồm metadataRevision để dùng làm baseRevision khi sửa metadata. Project nhận qua link nằm ở endpoint /projects/shared riêng.',
    responses: { ...commonErrorResponses, 200: { description: 'Danh sách project.', schema: z.object({ projects: z.array(PersistedProjectResponseSchema) }).strict() } },
  }),
  create: documentOperation({
    operationId: 'createProject', tag: 'projects', summary: 'Tạo project',
    description: 'Tạo project thuộc người gọi, có thể dùng templateVersionId. Response gồm metadataRevision; không dùng revision của file hoặc discussion sequence để cập nhật metadata.',
    body: CreateProjectRequestSchema.meta({ example: { title: 'Đồ án tốt nghiệp', category: 'thesis' } }),
    responses: { ...commonErrorResponses, 201: { description: 'Project vừa tạo.', schema: PersistedProjectResponseSchema } },
  }),
  get: documentOperation({
    operationId: 'getProject', tag: 'projects', summary: 'Đọc project và quyền của tôi', params,
    description: 'Yêu cầu quyền đọc project. Trả metadataRevision và access của người gọi, gồm canRead/canEdit/canManageSettings và phiên bản quyền dạng chuỗi. Quyền giám sát admin không tự cấp quyền sửa hoặc thảo luận.',
    responses: { ...commonErrorResponses, 200: { description: 'Project và capabilities hiện tại.', schema: PersistedProjectResponseSchema.extend({ access: accessResponseSchema }).strict() } },
  }),
  update: documentOperation({
    operationId: 'updateProjectMetadata', tag: 'projects', summary: 'Sửa tiêu đề hoặc danh mục project', params,
    description: 'Yêu cầu canEdit. Gửi baseRevision bằng metadataRevision đã đọc, cùng title/category cần đổi. CAS kiểm tra lại quyền và revision khi ghi; thành công trả metadataRevision mới. Thiếu revision trả428, revision cũ trả409, độc lập cờ chia sẻ. Không tự ghi đè dữ liệu mới hơn.',
    body: UpdateProjectRequestSchema.extend({ baseRevision: z.number().int().positive().describe('metadataRevision từ project đã đọc.') })
      .meta({ example: { baseRevision: 1, title: 'Đồ án tốt nghiệp (cập nhật)' } }),
    responses: { ...commonErrorResponses, 200: { description: 'Project đã cập nhật.', schema: PersistedProjectResponseSchema }, 409: conflict, 428: precondition },
  }),
  export: documentOperation({
    operationId: 'exportProjectArchive', tag: 'projects', summary: 'Tải toàn bộ tệp project dạng ZIP', params,
    description: 'Yêu cầu canExportProject (chủ project hoặc editor theo policy hiện hành). Trả stream ZIP gồm các tệp nguồn/tài nguyên, Content-Type application/zip và Content-Disposition attachment với filename UTF-8. Không cần baseRevision; đây là thao tác đọc/export, không sửa project.',
    responses: { ...commonErrorResponses, 200: { description: 'ZIP stream; đóng stream nếu client ngắt kết nối.',
      content: { 'application/zip': z.string().meta({ format: 'binary' }) },
      headers: { 'Content-Disposition': z.string().describe('attachment; filename="..."; filename*=UTF-8\'\'...') } } },
  }),
  import: documentOperation({
    operationId: 'importProjectArchive', tag: 'projects', summary: 'Tạo project từ tệp nén',
    query: ImportProjectQuerySchema, bodyContentType: 'multipart/form-data',
    body: z.object({ file: z.string().meta({ format: 'binary' }).describe('Tệp nén .zip/.7z/.rar/.tar/.tar.gz.') }),
    description: 'Tạo project mới thuộc người gọi từ archive upload. category/title nằm trong query, file nằm trong multipart. category bỏ trống dùng other; title trống dùng project.toml, tên archive rồi tên mặc định. Backend kiểm tra archive paths và giới hạn giải nén; phát hiện mainPath theo manifest/include graph. Response là project trực tiếp, không bọc {project}. Không nhập grants hoặc lịch sử chat của project khác.',
    responses: { ...commonErrorResponses, 201: { description: 'Project mới với metadataRevision.', schema: PersistedProjectResponseSchema },
      413: { description: 'Archive vượt giới hạn hoặc không đọc được phần file multipart.', schema: apiErrorSchema } },
  }),
  duplicate: documentOperation({
    operationId: 'duplicateProject', tag: 'projects', summary: 'Tạo bản sao project', params,
    body: z.object({ title: z.string().optional() }).strict(),
    description: 'Yêu cầu canDuplicateProject (chủ project hoặc editor theo policy hiện hành). Gửi JSON object, có thể {} khi không đổi tên; title được trim, giá trị trống dùng tên nguồn kèm (Bản sao). Tạo project mới thuộc người gọi, sao chép tệp/mainPath/compileOptions; private Zotero/OpenAlex config chỉ được giữ khi người gọi là chủ project nguồn, người khác nhận null. Không sao chép link/grants/chat. Trả project trực tiếp. Không yêu cầu baseRevision của project nguồn.',
    responses: { ...commonErrorResponses, 201: { description: 'Project bản sao với id và metadataRevision riêng.', schema: PersistedProjectResponseSchema } },
  }),
  delete: documentOperation({
    operationId: 'deleteProject', tag: 'projects', summary: 'Xóa project', params,
    description: 'Chỉ chủ project có canDelete được xóa; admin giám sát không tự có quyền xóa. Xóa project và dữ liệu phụ thuộc, dọn blob theo lifecycle hiện hành. Không có body/baseRevision trong contract này. Thành công204 không body;404 nếu project không tồn tại.',
    responses: { ...commonErrorResponses, 204: { description: 'Project đã xóa; không có body.' } },
  }),
};
