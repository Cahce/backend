# Requirements — Templates module (Backend)

## 1. Mục đích

Bổ sung backend module `templates` cho TLU Scholar Editor. Module này quản lý các **mẫu Typst** dùng để tạo dự án mới (luận văn, báo cáo, đề cương, ...). Frontend hiện tại có UI mock cho `/admin/templates` và phần "Tạo từ mẫu" trong `StudentDashboard`, nhưng backend chưa expose bất kỳ route nào cho `Template` / `TemplateVersion` — Prisma model đã tồn tại nhưng không có module.

Spec này định nghĩa:

- Module skeleton mới: `backend/src/modules/templates/` (Clean Architecture: delivery / application / domain / infra)
- Route group quản trị `/api/v1/admin/templates` (admin CRUD + upload nội dung)
- Route group người dùng `/api/v1/templates` (read-only, dùng để chọn mẫu khi tạo project)
- Cơ chế lưu trữ nội dung mẫu (Typst source) qua `storageKey` trên local filesystem ở phase 1
- Liên kết `Project.templateVersionId` được seed nội dung file từ template version khi tạo project

Backend là source of truth cho HTTP contract; spec frontend (`templates-frontend`) tham chiếu chéo các DTO ở đây.

## 2. Phạm vi

### In scope

- CRUD `Template`: tạo, list, get-by-id, update (metadata), delete (soft via `isActive`).
- CRUD `TemplateVersion`: tạo phiên bản mới (kèm upload nội dung), list theo template, get-by-id, update (metadata), deactivate.
- Upload nội dung phiên bản qua multipart (1 file `.typ` hoặc `.zip` chứa nhiều file).
- Endpoint công khai cho học viên/giáo viên: list template active + version active, dùng để hiển thị "Tạo từ mẫu".
- Tích hợp với module `projects`: khi tạo project có `templateVersionId`, backend copy nội dung từ template version vào `File` table.
- Seed dữ liệu mẫu (3-4 template official ban đầu) qua Prisma seed script.

### Out of scope

- Object storage (S3/MinIO): phase sau, hiện dùng filesystem local với path đặt theo `TEMPLATE_STORAGE_DIR`.
- Versioning kiểu Git (diff/merge): chỉ hỗ trợ version tuần tự (`v1.0.0`, `v1.1.0`, ...).
- Rating / lượt dùng / bookmark template: phase sau.
- Soft delete với restore: hiện tại `isActive=false` là cờ duy nhất; xóa cứng yêu cầu admin xác nhận và 409 nếu có project đang dùng.

## 3. User stories

### US-A — Admin quản lý template

- A1. Là admin, tôi cần list tất cả template (kèm filter `category`, `isOfficial`, `isActive`, search theo `name/description`, phân trang).
- A2. Là admin, tôi cần tạo template mới (`name`, `description`, `category`, `isOfficial`).
- A3. Là admin, tôi cần update metadata template (đổi tên, mô tả, category, toggle `isOfficial`/`isActive`).
- A4. Là admin, tôi cần xóa template — chỉ khi không còn project nào liên kết với version của nó.
- A5. Là admin, tôi cần list các version của 1 template kèm `versionNumber`, `changelog`, `isActive`, `createdAt`.
- A6. Là admin, tôi cần tạo version mới: nhập `versionNumber`, `changelog` (optional), upload file nội dung.
- A7. Là admin, tôi cần deactivate version cũ (`isActive=false`) để học viên không chọn được nữa.
- A8. Là admin, tôi cần download lại nội dung version để kiểm tra (debug).

### US-S — Học viên / giáo viên dùng template

- S1. Là user đã đăng nhập, tôi cần list các template `isActive=true` kèm version active mới nhất, để chọn khi tạo project.
- S2. Khi tạo project với `templateVersionId`, backend SHALL copy toàn bộ file của version đó vào `File` table của project mới.

## 4. Acceptance criteria (EARS)

### Auth

- WHEN không có Bearer token THEN admin route SHALL trả 401.
- WHEN role không phải `admin` THEN admin route SHALL trả 403.
- WHEN không có Bearer token THEN public template list SHALL trả 401 (yêu cầu đã đăng nhập, không cần admin).

### Admin CRUD template

- WHEN `POST /api/v1/admin/templates` với body hợp lệ THEN backend SHALL trả 201 + `Template` object.
- WHEN `category` ngoài enum `TemplateCategory` THEN backend SHALL trả 400 với `code=VALIDATION_ERROR`.
- WHEN `DELETE /api/v1/admin/templates/:id` mà có Project liên kết THEN backend SHALL trả 409 với `code=TEMPLATE_IN_USE`.

### Version

- WHEN `POST /api/v1/admin/templates/:id/versions` upload file `.typ` THEN backend SHALL ghi file ra `TEMPLATE_STORAGE_DIR/<templateId>/<versionId>/main.typ`, lưu `storageKey` chứa relative path, trả 201 + `TemplateVersion`.
- WHEN `versionNumber` trùng với version đã có của cùng template THEN backend SHALL trả 409 với `code=VERSION_EXISTS` (constraint `@@unique([templateId, versionNumber])`).
- WHEN file upload > 10 MB THEN backend SHALL trả 413 với `code=FILE_TOO_LARGE`.
- WHEN file `.zip` THEN backend SHALL extract và lưu từng file vào storage dir, ghi nhận entry-point `main.typ` (yêu cầu zip phải có file này ở root).

### Public read

- WHEN `GET /api/v1/templates` (đã đăng nhập) THEN backend SHALL trả `{ templates }` với mỗi template gồm `latestVersion` (version active mới nhất theo `createdAt DESC`). Templates `isActive=false` SHALL bị loại.

### Tích hợp projects

- WHEN `POST /api/v1/projects` với body `{ templateVersionId, ... }` THEN module `projects` SHALL gọi use case `MaterializeTemplateVersionUseCase` (export từ module `templates`) để copy file vào project mới.
- IF `templateVersionId` không tồn tại HOẶC `isActive=false` THEN backend SHALL trả 400 với `code=INVALID_TEMPLATE_VERSION`.

## 5. Non-functional

- File ghi/đọc filesystem PHẢI dùng path đã sanitize (chống path traversal; reject `..`, absolute paths trong zip).
- `TEMPLATE_STORAGE_DIR` đọc từ env, default `./storage/templates`. Spec deployment ghi vào file `.env.example`.
- Build và unit test phải pass: `cd backend && npm run build && npm run test:unit:templates` (test:unit:templates là script mới).

## 6. Open questions

- **OQ1**. Có cần endpoint preview HTML cho template trước khi học viên chọn? → Phase sau; phase 1 chỉ hiển thị metadata.
- **OQ2**. Có cần phân quyền "teacher có thể tạo template private" hay không? → Phase sau; phase 1 chỉ admin.
- **OQ3**. Versioning semantic (`major.minor.patch`) có ràng buộc tăng dần không? → Phase 1 chấp nhận free-form string, validate regex `^v?\d+\.\d+\.\d+$`.
