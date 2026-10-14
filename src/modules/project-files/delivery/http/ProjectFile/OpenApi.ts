import { z } from 'zod';
import { documentOperation, commonErrorResponses, apiErrorSchema } from '../../../../../shared/http/OpenApi.js';
import { CreateFileRequestSchema, UpdateFileRequestSchema, RenameFileRequestSchema,
  FileResponseSchema, FileListResponseSchema, FileKindSchema } from './Dto.js';

const params = z.object({ projectId: z.string() });
const pathParams = params.extend({ '*': z.string().describe('Đường dẫn tương đối; encode từng segment và giữ dấu / giữa thư mục.') });
const version = { fileId: z.string().min(1).describe('id ổn định của tệp đã đọc, chống xóa/tạo lại cùng path.'),
  baseRevision: z.number().int().positive().describe('revision của tệp đã đọc.') };
const conflict = { description: 'FILE_VERSION_CONFLICT hoặc đích đã tồn tại: tệp/id/revision/path đã đổi. Giữ draft và tải lại trước khi hợp nhất.', schema: apiErrorSchema };
const precondition = { description: 'PRECONDITION_REQUIRED: thiếu fileId/baseRevision. DELETE cũng trả428 khi query precondition không hợp lệ.', schema: apiErrorSchema };
const binary = z.string().meta({ format: 'binary' });
const fileSuccess = { description: 'Tệp cùng id/revision mới; nội dung text ở trường content.', schema: FileResponseSchema };
export const projectFileDocumentation = {
  list: documentOperation({
    operationId: 'listProjectFiles', tag: 'project-files', summary: 'Danh sách metadata tệp', params,
    description: 'Yêu cầu quyền đọc. Trả {files} theo path tăng dần, có id/revision để tạo precondition. Đây là metadata, không chứa content, storageKey hoặc sha256.',
    responses: { ...commonErrorResponses, 200: { description: 'Metadata tệp.', schema: FileListResponseSchema } },
  }),
  create: documentOperation({
    operationId: 'createProjectFile', tag: 'project-files', summary: 'Tạo tệp text mới', params, body: CreateFileRequestSchema,
    description: 'Yêu cầu canEdit. Tạo tệp ở path tương đối chưa tồn tại, trả id/revision. Không overwrite tệp cũ; đổi nội dung tệp hiện có qua PUT có CAS. kind bỏ trống được suy ra từ path.',
    responses: { ...commonErrorResponses, 201: fileSuccess, 409: conflict },
  }),
  upload: documentOperation({
    operationId: 'uploadProjectBinaryFile', tag: 'project-files', summary: 'Tải tệp nhị phân mới', params,
    transformUrl: url => url.replace(/\/files:upload$/, '/files::upload'),
    bodyContentType: 'multipart/form-data',
    body: z.object({ path: z.string().min(1).describe('Path tương đối chưa tồn tại; nên gửi trước file để truyền stream.'),
      kind: FileKindSchema.optional(), file: binary }),
    description: 'Yêu cầu canEdit. Multipart có path, file và kind tùy chọn; kiểm tra MIME/phần mở rộng và quyền lại trước commit. Create-only: path đã tồn tại trả409, không nhận baseRevision để replace. Tệp tạm được dọn nếu lưu metadata thất bại. Giới hạn dung lượng theo cấu hình multipart của server.',
    responses: { ...commonErrorResponses, 201: fileSuccess, 409: conflict,
      413: { description: 'Tệp vượt giới hạn upload.', schema: apiErrorSchema },
      415: { description: 'MIME không được hỗ trợ.', schema: apiErrorSchema } },
  }),
  get: documentOperation({
    operationId: 'getProjectFile', tag: 'project-files', summary: 'Đọc tệp text hoặc tải nhị phân', params: pathParams,
    description: 'Yêu cầu quyền đọc. Tệp text trả JSON với content/id/revision. Tệp nhị phân trong blob storage trả bytes với Content-Type thực và header X-File-Id/X-File-Revision; dùng hai header này cho rename/delete CAS. Wildcard có thể chứa nhiều thư mục, encode từng segment. Blob không tồn tại trả404 STORAGE_NOT_FOUND.',
    responses: { ...commonErrorResponses, 200: {
      description: 'JSON text hoặc binary stream theo loại tệp; các header metadata chỉ áp dụng cho stream.',
      content: { 'application/json': FileResponseSchema, '*/*': binary },
      headers: { 'X-File-Id': z.string().describe('ID tệp khi response là binary.'),
        'X-File-Revision': z.number().int().positive().describe('Revision tệp khi response là binary.') },
    } },
  }),
  update: documentOperation({
    operationId: 'updateProjectFileContent', tag: 'project-files', summary: 'Lưu nội dung tệp bằng CAS', params: pathParams,
    body: UpdateFileRequestSchema.extend(version),
    description: 'Yêu cầu canEdit. Gửi content cùng fileId/baseRevision của tệp tại path đã đọc. Backend kiểm tra lại quyền, path, id và revision trong transaction; thành công trả revision mới. Hai writer cùng revision chỉ một lưu được. Thiếu precondition trả428; stale/ABA trả409. Không làm mất bản nháp khi conflict.',
    responses: { ...commonErrorResponses, 200: fileSuccess, 409: conflict, 428: precondition },
  }),
  rename: documentOperation({
    operationId: 'renameProjectFile', tag: 'project-files', summary: 'Đổi path tệp bằng CAS', params,
    transformUrl: url => url.replace(/\/files:rename$/, '/files::rename'),
    query: z.object({ path: z.string().describe('Đường dẫn hiện tại, encode bằng URL query.') }),
    body: RenameFileRequestSchema.extend(version),
    description: 'Yêu cầu canEdit. path hiện tại nằm trong query; newPath/fileId/baseRevision trong JSON body. Giữ id và tăng revision sau rename. Thiếu precondition trả428; tệp đã đổi hoặc newPath tồn tại trả409.',
    responses: { ...commonErrorResponses, 200: fileSuccess, 409: conflict, 428: precondition },
  }),
  delete: documentOperation({
    operationId: 'deleteProjectFile', tag: 'project-files', summary: 'Xóa tệp bằng CAS', params: pathParams,
    query: z.object({ fileId: version.fileId.max(128), baseRevision: version.baseRevision }),
    description: 'Yêu cầu canEdit. Gửi fileId và baseRevision trong query, không gửi body. Query baseRevision được coerce thành số nguyên dương ở runtime; thiếu/sai precondition trả428, stale id/revision trả409. Thành công204 và không có response body.',
    responses: { ...commonErrorResponses, 204: { description: 'Tệp đã xóa, không có body.' }, 409: conflict, 428: precondition },
  }),
};
