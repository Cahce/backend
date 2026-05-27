# Hướng Dẫn Kiểm Tra Editor Backend

**Ngày**: 2026-05-05  
**Trạng thái**: Implementation hoàn tất, sẵn sàng kiểm tra

---

## Bước 1: Cấu Hình Environment

### 1.1 Tạo file .env
```powershell
# Copy file mẫu
Copy-Item .env.example .env
```

### 1.2 Chỉnh sửa .env
Mở file `.env` và cấu hình:

```env
# Database - Thay đổi theo database của bạn
DATABASE_URL=postgresql://postgres:password@localhost:5432/typst_platform

# Auth - Tạo secret key mạnh
JWT_SECRET=your-super-secret-key-change-this-in-production

# Server
PORT=3000
HOST=0.0.0.0

# Storage - Thư mục lưu file
BLOB_STORAGE_DRIVER=local
STORAGE_DIR=./.storage

# Compile - Cấu hình biên dịch
COMPILE_WORKER_ENABLED=true
COMPILE_TIMEOUT_MS=60000

# Swagger - API documentation
SWAGGER_ROUTE_PREFIX=/docs
ENABLE_SWAGGER=true

# Log level
LOG_LEVEL=info
```

**LƯU Ý**: Backend sử dụng `@myriaddreamin/typst-ts-node-compiler` (đã được cài đặt qua npm), không cần cài đặt Typst CLI riêng!

---

## Bước 2: Cài Đặt Dependencies

```powershell
npm install
```

---

## Bước 3: Chạy Database Migrations

```powershell
# Chạy migrations
npx prisma migrate dev

# Nếu cần reset database
npx prisma migrate reset
```

---

## Bước 4: Khởi Động Server

### Development Mode (Khuyến nghị)
```powershell
npm run dev
```

Server sẽ chạy tại: `http://localhost:3000`

Bạn sẽ thấy log:
```
[INFO] Server listening at http://0.0.0.0:3000
[INFO] storage driver: local
[INFO] Compile worker started
```

### Production Build
```powershell
npm run build
npm start
```

---

## Bước 5: Kiểm Tra API với Swagger

Mở trình duyệt và truy cập:
```
http://localhost:3000/docs
```

Bạn sẽ thấy Swagger UI với tất cả endpoints, bao gồm:
- **auth** - Đăng nhập, đăng ký
- **projects** - Quản lý dự án
- **project-files** - Quản lý file
- **project-settings** - Cài đặt dự án (MỚI)
- **compile** - Biên dịch tài liệu (MỚI)

---

## Bước 6: Kiểm Tra Thủ Công (Manual Testing)

### 6.1 Đăng Nhập

**Endpoint**: `POST /api/v1/auth/login`

**Request**:
```json
{
  "email": "student@example.com",
  "password": "password123"
}
```

**Cách test với Swagger**:
1. Mở `http://localhost:3000/docs`
2. Tìm endpoint `POST /api/v1/auth/login`
3. Click "Try it out"
4. Nhập email và password
5. Click "Execute"

**Kết quả mong đợi**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-id",
    "email": "student@example.com",
    "role": "student"
  }
}
```

**LƯU Ý**: Copy `accessToken` để dùng cho các request tiếp theo!

---

### 6.2 Authorize trong Swagger

1. Click nút **"Authorize"** ở góc trên bên phải Swagger UI
2. Nhập: `Bearer <accessToken>` (thay `<accessToken>` bằng token vừa copy)
3. Click "Authorize"
4. Click "Close"

Giờ tất cả request sẽ tự động có token!

---

### 6.3 Tạo Dự Án

**Endpoint**: `POST /api/v1/projects`

**Request**:
```json
{
  "title": "Dự Án Test Biên Dịch",
  "category": "thesis"
}
```

**Kết quả mong đợi**:
```json
{
  "id": "project-id-123",
  "title": "Dự Án Test Biên Dịch",
  "category": "thesis",
  "ownerId": "user-id",
  "createdAt": "2026-05-05T10:00:00.000Z",
  ...
}
```

**LƯU Ý**: Copy `id` của project để dùng cho các bước tiếp theo!

---

### 6.4 Tạo File Typst

**Endpoint**: `PUT /api/v1/projects/{projectId}/files/main.typ`

Thay `{projectId}` bằng ID project vừa tạo.

**Request**:
```json
{
  "content": "= Xin Chào Thế Giới\n\nĐây là tài liệu Typst đầu tiên của tôi.\n\n== Phần 1\n\nNội dung phần 1.\n\n== Phần 2\n\nNội dung phần 2."
}
```

**Kết quả mong đợi**: Status 201 Created

---

### 6.5 Kiểm Tra Project Settings (MỚI)

**Endpoint**: `GET /api/v1/projects/{projectId}/settings`

**Kết quả mong đợi**:
```json
{
  "settings": {
    "projectId": "project-id-123",
    "mainPath": "main.typ",
    "compileOptions": {},
    "zoteroConfig": null,
    "updatedAt": "2026-05-05T10:00:00.000Z"
  }
}
```

**Giải thích**: Settings tự động được tạo với `mainPath = "main.typ"` mặc định.

---

### 6.6 Biên Dịch Tài Liệu (MỚI - QUAN TRỌNG)

**Endpoint**: `POST /api/v1/projects/{projectId}/compile`

**Request** (để trống hoặc):
```json
{
  "entryPath": "main.typ"
}
```

**Kết quả mong đợi**: Status 202 Accepted
```json
{
  "job": {
    "id": "job-id-456",
    "projectId": "project-id-123",
    "entryPath": "main.typ",
    "status": "queued",
    "diagnostics": [],
    "latestArtifactId": null,
    "createdAt": "2026-05-05T10:00:00.000Z",
    "updatedAt": "2026-05-05T10:00:00.000Z"
  }
}
```

**LƯU Ý**: Copy `job.id` để kiểm tra trạng thái!

---

### 6.7 Kiểm Tra Trạng Thái Biên Dịch

**Endpoint**: `GET /api/v1/projects/{projectId}/compile/{jobId}`

Thay `{jobId}` bằng ID job vừa tạo.

**Kết quả khi đang xử lý**:
```json
{
  "job": {
    "id": "job-id-456",
    "status": "running",
    ...
  }
}
```

**Kết quả khi hoàn thành**:
```json
{
  "job": {
    "id": "job-id-456",
    "status": "success",
    "diagnostics": [],
    "latestArtifactId": "artifact-id-789",
    ...
  }
}
```

**Kết quả khi có lỗi**:
```json
{
  "job": {
    "id": "job-id-456",
    "status": "failed",
    "diagnostics": [
      {
        "severity": "error",
        "message": "type mismatch",
        "file": "main.typ",
        "range": {
          "start": { "line": 5, "column": 10 },
          "end": { "line": 5, "column": 15 }
        },
        "hints": ["try converting with str(...)"]
      }
    ],
    ...
  }
}
```

**LƯU Ý**: Poll endpoint này mỗi 1-2 giây cho đến khi `status` là `success` hoặc `failed`.

---

### 6.8 Tải PDF (MỚI - QUAN TRỌNG)

**Endpoint**: `GET /api/v1/projects/{projectId}/compile/{jobId}/artifact`

**Cách test**:
1. Trong Swagger, tìm endpoint này
2. Click "Try it out"
3. Nhập projectId và jobId
4. Click "Execute"
5. Click "Download file" để tải PDF

**Hoặc dùng trình duyệt**:
```
http://localhost:3000/api/v1/projects/{projectId}/compile/{jobId}/artifact
```

**Kết quả mong đợi**: File PDF tải về, mở được và hiển thị nội dung "Xin Chào Thế Giới".

---

## Bước 7: Kiểm Tra Các Tính Năng Mới

### 7.1 Binary Streaming (Hình Ảnh)

**Test**: Upload và tải hình ảnh

1. **Upload hình ảnh**:
   - Endpoint: `POST /api/v1/projects/{projectId}/files`
   - Body:
     ```json
     {
       "path": "images/logo.png",
       "kind": "image",
       "content": "<base64-encoded-image>",
       "mimeType": "image/png"
     }
     ```

2. **Tải hình ảnh**:
   - Endpoint: `GET /api/v1/projects/{projectId}/files/images/logo.png`
   - Kết quả: Binary stream với header `Content-Type: image/png`

---

### 7.2 Conflict Detection

**Test**: Tạo file trùng path

1. Tạo file `test.typ`
2. Thử tạo lại file `test.typ`
3. **Kết quả mong đợi**: Status 409 Conflict
   ```json
   {
     "error": {
       "code": "FILE_ALREADY_EXISTS",
       "message": "File already exists at path: test.typ"
     }
   }
   ```

---

### 7.3 Update Project Settings

**Test**: Thay đổi mainPath

**Endpoint**: `PUT /api/v1/projects/{projectId}/settings`

**Request**:
```json
{
  "mainPath": "main.typ",
  "compileOptions": {
    "ppi": 144
  }
}
```

**Kết quả mong đợi**: Status 200 OK

**Test lỗi - mainPath không tồn tại**:
```json
{
  "mainPath": "notexist.typ"
}
```

**Kết quả mong đợi**: Status 400 Bad Request
```json
{
  "error": {
    "code": "INVALID_MAIN_PATH",
    "message": "Main path does not exist in project files"
  }
}
```

---

## Bước 8: Kiểm Tra Logs

Trong terminal nơi server đang chạy, bạn sẽ thấy logs:

```
[INFO] Job abc123 enqueued, queue length: 1
[INFO] Processing job abc123...
[INFO] Job abc123 completed
```

Nếu có lỗi:
```
[ERROR] Job abc123 failed: <error message>
```

---

## Bước 9: Kiểm Tra Storage

Kiểm tra thư mục storage:

```powershell
ls .storage
```

Bạn sẽ thấy cấu trúc:
```
.storage/
  ab/
    abc123...bin       # File PDF
    abc123...bin.json  # Metadata
  cd/
    cde456...bin
    cde456...bin.json
```

---

## Các Lỗi Thường Gặp

### Lỗi 1: Job stuck ở "queued"
**Nguyên nhân**: Worker không chạy  
**Giải pháp**: 
1. Kiểm tra `.env`: `COMPILE_WORKER_ENABLED=true`
2. Restart server
3. Kiểm tra logs có dòng "Compile worker started"

### Lỗi 2: "STORAGE_NOT_FOUND"
**Nguyên nhân**: Thư mục storage không tồn tại  
**Giải pháát**: 
```powershell
mkdir .storage
```

### Lỗi 3: Compile timeout
**Nguyên nhân**: Tài liệu quá phức tạp hoặc compiler bị treo  
**Giải pháp**: 
1. Tăng `COMPILE_TIMEOUT_MS` trong `.env`
2. Đơn giản hóa tài liệu
3. Kiểm tra logs để xem chi tiết lỗi

### Lỗi 4: Database connection failed
**Nguyên nhân**: PostgreSQL không chạy hoặc DATABASE_URL sai  
**Giải pháp**:
1. Kiểm tra PostgreSQL đang chạy
2. Kiểm tra DATABASE_URL trong `.env`
3. Test connection:
   ```powershell
   npx prisma db pull
   ```

---

## Checklist Kiểm Tra Đầy Đủ

### Cơ Bản
- [ ] Server khởi động không lỗi
- [ ] Swagger UI hiển thị tại /docs
- [ ] Đăng nhập thành công
- [ ] Tạo project thành công
- [ ] Tạo file Typst thành công
- [ ] GET settings tự động tạo với mainPath mặc định
- [ ] Enqueue compile job thành công (202)
- [ ] Job chuyển trạng thái: queued → running → success
- [ ] Tải PDF thành công
- [ ] PDF mở được và hiển thị đúng nội dung

### Tính Năng Mới
- [ ] Binary streaming cho hình ảnh hoạt động
- [ ] Conflict detection trả về 409
- [ ] Update settings thành công
- [ ] Validate mainPath hoạt động
- [ ] LastEditedAt được cập nhật cho cả file và project

### Xử Lý Lỗi
- [ ] Syntax error trong Typst hiển thị diagnostics
- [ ] File không tồn tại trả về 404
- [ ] Unauthorized trả về 403
- [ ] Compile timeout được xử lý đúng

---

## Kiểm Tra Nâng Cao

### Test với Postman

1. Import Swagger JSON:
   - Truy cập: `http://localhost:3000/docs/json`
   - Copy JSON
   - Import vào Postman

2. Tạo Environment trong Postman:
   ```
   baseUrl: http://localhost:3000
   token: <your-access-token>
   projectId: <your-project-id>
   jobId: <your-job-id>
   ```

3. Chạy collection tests

### Test với cURL

```powershell
# Login
curl -X POST http://localhost:3000/api/v1/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"student@example.com","password":"password123"}'

# Create project
curl -X POST http://localhost:3000/api/v1/projects `
  -H "Authorization: Bearer <token>" `
  -H "Content-Type: application/json" `
  -d '{"title":"Test Project"}'

# Create file
curl -X PUT http://localhost:3000/api/v1/projects/<projectId>/files/main.typ `
  -H "Authorization: Bearer <token>" `
  -H "Content-Type: application/json" `
  -d '{"content":"= Hello World"}'

# Compile
curl -X POST http://localhost:3000/api/v1/projects/<projectId>/compile `
  -H "Authorization: Bearer <token>" `
  -H "Content-Type: application/json"

# Get job status
curl http://localhost:3000/api/v1/projects/<projectId>/compile/<jobId> `
  -H "Authorization: Bearer <token>"

# Download PDF
curl -OJ http://localhost:3000/api/v1/projects/<projectId>/compile/<jobId>/artifact `
  -H "Authorization: Bearer <token>"
```

---

## Kết Luận

Sau khi hoàn thành tất cả các bước kiểm tra:

✅ **Thành công** nếu:
- Server chạy không lỗi
- Tất cả endpoints hoạt động
- Compile flow hoàn chỉnh: tạo file → compile → tải PDF
- PDF hiển thị đúng nội dung

⚠️ **Cần xem xét** nếu:
- Một số endpoints thất bại
- Compile timeout thường xuyên
- Storage errors

❌ **Thất bại** nếu:
- Server không khởi động được
- Không compile được tài liệu đơn giản
- PDF không tải được

---

## Hỗ Trợ

**Tài liệu**:
- Spec đầy đủ: `.kiro/specs/editor-backend/`
- Quick start: `.kiro/specs/editor-backend/QUICK_START.md`
- Integration report: `.kiro/reports/backend-frontend-integration/editor-backend-integration-status.md`

**Debug**:
- Bật debug logging: `LOG_LEVEL=debug` trong `.env`
- Kiểm tra server logs
- Kiểm tra database với Prisma Studio: `npx prisma studio`

**Báo lỗi**: Ghi lại error message từ logs và endpoint nào gây lỗi.
