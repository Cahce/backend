# Requirements — Template Project Materialization Fix

## 1. Mục đích

Sửa lỗi trong luồng materialize template khi tạo project. Hiện tại có mismatch giữa cách `MaterializeTemplateVersionUseCase` throw error và cách `CreateProjectUseCase` catch error, dẫn đến việc error handling không hoạt động đúng.

**Vấn đề hiện tại**:
- `TemplatesContainer.getMaterializeFunction()` throw `Error` với `message = error.code`
- `CreateProjectUseCase` check `error.message === 'INVALID_TEMPLATE_VERSION'`
- Điều này hoạt động nhưng không rõ ràng và dễ gây nhầm lẫn

**Giải pháp**:
- Tạo custom error class `InvalidTemplateVersionError` trong templates domain
- Throw error class thay vì generic Error
- Catch error class trong CreateProjectUseCase
- Cải thiện error handling và logging

## 2. Phạm vi

### In scope

- Tạo `InvalidTemplateVersionError` class trong `templates/domain/Errors.ts`
- Cập nhật `TemplatesContainer.getMaterializeFunction()` để throw custom error
- Cập nhật `CreateProjectUseCase` để catch custom error
- Thêm logging cho debugging
- Cập nhật unit tests để verify error handling
- Đảm bảo backward compatibility với existing behavior

### Out of scope

- Thay đổi API contract (HTTP status codes, response format)
- Thay đổi database schema
- Thay đổi storage implementation
- Refactor toàn bộ error handling system

## 3. User stories

### US-1 — Developer debugging

- Là developer, khi template materialization fail, tôi cần thấy error message rõ ràng trong logs để debug.
- Là developer, tôi cần error stack trace đầy đủ để trace lỗi qua các module.

### US-2 — End user experience

- Là user, khi tạo project với template không hợp lệ, tôi cần nhận được error message tiếng Việt rõ ràng.
- Là user, khi template version bị deactivate, tôi cần biết lý do không thể sử dụng.

## 4. Acceptance criteria (EARS)

### Error class

- WHEN `InvalidTemplateVersionError` được throw THEN error SHALL có property `code = 'INVALID_TEMPLATE_VERSION'`.
- WHEN error được throw THEN error SHALL extend `Error` class để có stack trace.
- WHEN error được throw THEN error SHALL có message tiếng Việt cho end user.

### Container

- WHEN `getMaterializeFunction()` gọi `materializeTemplateVersion.execute()` và result.success = false THEN SHALL throw `InvalidTemplateVersionError`.
- WHEN error code là `'INVALID_TEMPLATE_VERSION'` THEN SHALL throw với message "Phiên bản mẫu không hợp lệ hoặc không còn hoạt động".
- WHEN error code khác THEN SHALL throw generic Error với message từ result.error.message.

### CreateProjectUseCase

- WHEN catch error THEN SHALL check `error instanceof InvalidTemplateVersionError`.
- WHEN `InvalidTemplateVersionError` caught THEN SHALL return failure với code và message từ error.
- WHEN generic Error caught THEN SHALL log error và return `INTERNAL_ERROR`.

### Logging

- WHEN template materialization bắt đầu THEN SHALL log `info` với projectId và templateVersionId.
- WHEN materialization thành công THEN SHALL log `info` với số lượng files created.
- WHEN materialization fail THEN SHALL log `error` với error details và stack trace.

### Backward compatibility

- WHEN existing projects được tạo không có templateVersionId THEN SHALL hoạt động như cũ (empty project).
- WHEN API response format THEN SHALL giữ nguyên (không breaking change).

## 5. Non-functional

- Error handling PHẢI rõ ràng và dễ debug.
- Logs PHẢI có đủ context (projectId, templateVersionId, userId).
- Performance KHÔNG bị ảnh hưởng (error handling overhead < 1ms).
- Unit tests PHẢI cover tất cả error paths.

## 6. Open questions

- **OQ1**. Có cần retry logic khi storage.readFiles() fail tạm thời? → Phase sau; phase 1 fail fast.
- **OQ2**. Có cần metric/monitoring cho template materialization success rate? → Phase sau.
- **OQ3**. Có cần rollback project nếu materialization fail sau khi project đã được tạo? → Không; hiện tại project được tạo trước, nếu materialization fail thì project rỗng (acceptable).

