# Checklist Kiểm Tra Editor Backend

**Ngày**: 2026-05-05  
**Mục đích**: Kiểm tra nhanh các tính năng đã implement

---

## Chuẩn Bị

- [ ] Đã cài đặt Typst CLI (`typst --version` hoạt động)
- [ ] Đã tạo file `.env` từ `.env.example`
- [ ] Đã cấu hình `DATABASE_URL` đúng
- [ ] Đã chạy `npm install`
- [ ] Đã chạy `npx prisma migrate dev`
- [ ] Đã có user test trong database

---

## Khởi Động

- [ ] Server khởi động thành công: `npm run dev`
- [ ] Không có error trong console
- [ ] Thấy log: "Server listening at http://0.0.0.0:3000"
- [ ] Thấy log: "storage driver: local"
- [ ] Thấy log: "Compile worker started"
- [ ] Swagger UI hoạt động: `http://localhost:3000/docs`

---

## Test Cơ Bản

### Authentication
- [ ] POST `/api/v1/auth/login` thành công
- [ ] Nhận được `accessToken`
- [ ] Authorize trong Swagger thành công

### Projects
- [ ] POST `/api/v1/projects` tạo project thành công
- [ ] GET `/api/v1/projects` list projects thành công
- [ ] GET `/api/v1/projects/:id` get project thành công

### Files
- [ ] PUT `/api/v1/projects/:id/files/main.typ` tạo file thành công
- [ ] GET `/api/v1/projects/:id/files` list files thành công
- [ ] GET `/api/v1/projects/:id/files/main.typ` get file thành công
- [ ] PUT `/api/v1/projects/:id/files/main.typ` update file thành công

---

## Test Tính Năng Mới

### Project Settings (Phase 2)
- [ ] GET `/api/v1/projects/:id/settings` trả về settings
- [ ] Settings có `mainPath = "main.typ"` mặc định
- [ ] PUT `/api/v1/projects/:id/settings` update thành công
- [ ] Update với `mainPath` không tồn tại → 400 error
- [ ] Update với `mainPath = "../escape.typ"` → 400 error

### Binary Streaming (Phase 3)
- [ ] Upload file image thành công
- [ ] GET image file trả về binary stream (không phải JSON)
- [ ] Response có header `Content-Type: image/png`
- [ ] Response có header `Content-Length`

### Conflict Detection (Phase 3)
- [ ] POST file với path đã tồn tại → 409 error
- [ ] PATCH rename đến path đã tồn tại → 409 error
- [ ] Error response có `code: "FILE_ALREADY_EXISTS"`

### Compile Module (Phase 4)

#### Enqueue Job
- [ ] POST `/api/v1/projects/:id/compile` thành công
- [ ] Response status = 202 Accepted
- [ ] Response có `job.status = "queued"`
- [ ] Response có `job.id`

#### Job Status
- [ ] GET `/api/v1/projects/:id/compile/:jobId` thành công
- [ ] Job chuyển từ "queued" → "running"
- [ ] Job chuyển từ "running" → "success"
- [ ] Job có `latestArtifactId` khi success

#### List Jobs
- [ ] GET `/api/v1/projects/:id/compile` list jobs thành công
- [ ] Jobs được sắp xếp theo `createdAt` giảm dần

#### Download Artifact
- [ ] GET `/api/v1/projects/:id/compile/:jobId/artifact` thành công
- [ ] Response là binary PDF
- [ ] Response có header `Content-Type: application/pdf`
- [ ] Response có header `Content-Length`
- [ ] Response có header `ETag`
- [ ] PDF tải về mở được
- [ ] PDF hiển thị đúng nội dung

#### Deduplication
- [ ] POST compile 2 lần liên tiếp
- [ ] Lần 2 trả về cùng job ID (không tạo job mới)

---

## Test Error Scenarios

### Compile Errors
- [ ] Tạo file với syntax error Typst
- [ ] Compile job chuyển sang "failed"
- [ ] Response có `diagnostics` array
- [ ] Diagnostic có `severity`, `message`, `file`, `range`
- [ ] Diagnostic có `hints` nếu có

### Missing File
- [ ] Compile với `entryPath` không tồn tại
- [ ] Job failed với diagnostic phù hợp

### Timeout
- [ ] Tạo file Typst phức tạp (vòng lặp lớn)
- [ ] Set `COMPILE_TIMEOUT_MS=5000` (5 giây)
- [ ] Compile timeout được xử lý đúng

### Authorization
- [ ] Request không có token → 401 error
- [ ] Request với token sai → 401 error
- [ ] Access project của người khác → 403 error

---

## Test Performance

### Storage
- [ ] Kiểm tra thư mục `.storage` được tạo
- [ ] Files được lưu với cấu trúc `<2-char-prefix>/<sha256>.bin`
- [ ] Metadata files `.json` tồn tại
- [ ] Upload cùng nội dung 2 lần → cùng sha256

### Queue
- [ ] Enqueue nhiều jobs liên tiếp
- [ ] Jobs được xử lý tuần tự (không song song)
- [ ] Logs hiển thị "Processing job..." cho từng job

### Transactions
- [ ] Update file
- [ ] Kiểm tra `file.lastEditedAt` được update
- [ ] Kiểm tra `project.lastEditedAt` được update
- [ ] Cả 2 timestamps giống nhau (cùng transaction)

---

## Test với Script Tự Động

- [ ] Chạy script: `.\scripts\test-compile-flow.ps1`
- [ ] Script chạy hết 7 bước không lỗi
- [ ] PDF được tải về tự động
- [ ] PDF mở được và hiển thị đúng

---

## Kết Quả

### ✅ PASS nếu:
- Tất cả checkboxes được tick
- Không có error không mong đợi
- PDF compile thành công và hiển thị đúng

### ⚠️ PARTIAL PASS nếu:
- Hầu hết features hoạt động
- Một số edge cases có vấn đề
- Performance chấp nhận được

### ❌ FAIL nếu:
- Server không khởi động được
- Compile flow không hoạt động
- PDF không tạo được hoặc bị lỗi

---

## Ghi Chú

**Thời gian test**: ___________  
**Người test**: ___________  
**Kết quả**: ☐ PASS  ☐ PARTIAL PASS  ☐ FAIL

**Issues phát hiện**:
1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

**Ghi chú thêm**:
___________________________________________
___________________________________________
___________________________________________
