# Hướng Dẫn Test API Trên Swagger

**Ngày**: 2026-05-05  
**Mục đích**: Hướng dẫn chi tiết cách test các API endpoints trên Swagger UI

---

## Bước 1: Chuẩn Bị Dữ Liệu Test

### 1.1 Seed Dữ Liệu

Chạy các lệnh sau để tạo dữ liệu test:

```powershell
# Seed tất cả (users + admin data + test projects)
npm run seed:all

# Hoặc seed từng phần:
npm run seed:users      # Tạo users (admin, teacher, student)
npm run seed:admin      # Tạo academic data (faculty, department, etc.)
npm run seed:projects   # Tạo test projects với Typst files
```

**Kết quả**:
- ✅ 3 users: admin, teacher, student
- ✅ 5 faculties, 5 departments, 5 majors, 5 classes
- ✅ 5 teachers, 5 students
- ✅ 5 test projects với Typst files

### 1.2 Khởi Động Server

```powershell
npm run dev
```

**Kiểm tra**: Server chạy tại `http://localhost:3000`

---

## Bước 2: Truy Cập Swagger UI

Mở trình duyệt và truy cập:
```
http://localhost:3000/docs
```

Bạn sẽ thấy Swagger UI với tất cả endpoints được nhóm theo tags:
- **auth** - Authentication
- **projects** - Project management
- **project-files** - File management
- **project-settings** - Project settings
- **compile** - Compile API

---

## Bước 3: Đăng Nhập (Authentication)

### 3.1 Tìm Endpoint Login

1. Scroll xuống phần **auth** tag
2. Tìm endpoint `POST /api/v1/auth/login`
3. Click vào để mở rộng

### 3.2 Thực Hiện Login

1. Click nút **"Try it out"**
2. Nhập thông tin đăng nhập:

**Student Account**:
```json
{
  "email": "2251172560@e.tlu.edu.vn",
  "password": "123456"
}
```

**Teacher Account**:
```json
{
  "email": "kieutuandung@tlu.edu.vn",
  "password": "123456"
}
```

**Admin Account**:
```json
{
  "email": "admin@tlu.edu.vn",
  "password": "123456"
}
```

3. Click **"Execute"**

### 3.3 Copy Access Token

Trong response, bạn sẽ thấy:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "2251172560@e.tlu.edu.vn",
    "role": "student"
  }
}
```

**Copy toàn bộ `accessToken`** (chuỗi dài bắt đầu bằng `eyJ...`)

---

## Bước 4: Authorize Swagger

### 4.1 Click Nút Authorize

Ở góc trên bên phải của Swagger UI, click nút **"Authorize"** (biểu tượng ổ khóa)

### 4.2 Nhập Token

1. Trong popup, nhập: `Bearer <accessToken>`
   - **Lưu ý**: Phải có chữ `Bearer` và một khoảng trắng trước token
   - Ví dụ: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

2. Click **"Authorize"**
3. Click **"Close"**

**Kết quả**: Tất cả requests sau này sẽ tự động có token!

---

## Bước 5: Test Projects API

### 5.1 List All Projects

**Endpoint**: `GET /api/v1/projects`

1. Tìm endpoint trong tag **projects**
2. Click **"Try it out"**
3. Click **"Execute"**

**Kết quả mong đợi**:
```json
{
  "projects": [
    {
      "id": "test-simple-project",
      "title": "Tài Liệu Đơn Giản",
      "category": "report",
      "ownerId": "...",
      "createdAt": "...",
      "lastEditedAt": "..."
    },
    ...
  ]
}
```

**Copy một `id` để dùng cho các bước tiếp theo!**

### 5.2 Get Project Details

**Endpoint**: `GET /api/v1/projects/{id}`

1. Click **"Try it out"**
2. Nhập `id` vừa copy (ví dụ: `test-simple-project`)
3. Click **"Execute"**

**Kết quả**: Chi tiết project

### 5.3 Create New Project

**Endpoint**: `POST /api/v1/projects`

1. Click **"Try it out"**
2. Nhập request body:
```json
{
  "title": "Dự Án Test Mới",
  "category": "report"
}
```
3. Click **"Execute"**

**Kết quả**: Project mới được tạo với status 201

---

## Bước 6: Test Files API

### 6.1 List Files in Project

**Endpoint**: `GET /api/v1/projects/{projectId}/files`

1. Click **"Try it out"**
2. Nhập `projectId` (ví dụ: `test-simple-project`)
3. Click **"Execute"**

**Kết quả**:
```json
{
  "files": [
    {
      "id": "...",
      "path": "main.typ",
      "kind": "typst",
      "sizeBytes": 1234,
      "createdAt": "...",
      "lastEditedAt": "..."
    }
  ]
}
```

### 6.2 Get File Content

**Endpoint**: `GET /api/v1/projects/{projectId}/files/*`

1. Click **"Try it out"**
2. Nhập `projectId` và `*` = `main.typ`
3. Click **"Execute"**

**Kết quả**: Nội dung file Typst

### 6.3 Create New File

**Endpoint**: `POST /api/v1/projects/{projectId}/files`

1. Click **"Try it out"**
2. Nhập `projectId`
3. Nhập request body:
```json
{
  "path": "chapter1.typ",
  "kind": "typst",
  "content": "= Chương 1\n\nNội dung chương 1."
}
```
4. Click **"Execute"**

**Kết quả**: File mới được tạo

### 6.4 Update File Content

**Endpoint**: `PUT /api/v1/projects/{projectId}/files/*`

1. Click **"Try it out"**
2. Nhập `projectId` và `*` = `main.typ`
3. Nhập request body:
```json
{
  "content": "= Nội Dung Mới\n\nĐã cập nhật."
}
```
4. Click **"Execute"**

**Kết quả**: File được cập nhật

---

## Bước 7: Test Project Settings API

### 7.1 Get Project Settings

**Endpoint**: `GET /api/v1/projects/{id}/settings`

1. Click **"Try it out"**
2. Nhập `id` (ví dụ: `test-simple-project`)
3. Click **"Execute"**

**Kết quả**:
```json
{
  "settings": {
    "projectId": "test-simple-project",
    "mainPath": "main.typ",
    "compileOptions": {},
    "zoteroConfig": null,
    "updatedAt": "..."
  }
}
```

**Lưu ý**: Settings tự động được tạo với `mainPath = "main.typ"` mặc định

### 7.2 Update Project Settings

**Endpoint**: `PUT /api/v1/projects/{id}/settings`

1. Click **"Try it out"**
2. Nhập `id`
3. Nhập request body:
```json
{
  "mainPath": "main.typ",
  "compileOptions": {
    "ppi": 144
  }
}
```
4. Click **"Execute"**

**Kết quả**: Settings được cập nhật

---

## Bước 8: Test Compile API (QUAN TRỌNG)

### 8.1 Enqueue Compile Job

**Endpoint**: `POST /api/v1/projects/{id}/compile`

1. Click **"Try it out"**
2. Nhập `id` (ví dụ: `test-simple-project`)
3. Nhập request body (optional):
```json
{
  "entryPath": "main.typ"
}
```
4. Click **"Execute"**

**Kết quả mong đợi**: Status 202 Accepted
```json
{
  "job": {
    "id": "cmos2zukg0001w0vm7k75oofj",
    "projectId": "test-simple-project",
    "entryPath": "main.typ",
    "status": "queued",
    "diagnostics": [],
    "latestArtifactId": null,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Copy `job.id` để dùng cho bước tiếp theo!**

### 8.2 Check Compile Status

**Endpoint**: `GET /api/v1/projects/{projectId}/compile/{jobId}`

1. Click **"Try it out"**
2. Nhập `projectId` và `jobId` vừa copy
3. Click **"Execute"**
4. **Đợi 2-5 giây** rồi click **"Execute"** lại

**Kết quả khi đang compile**:
```json
{
  "job": {
    "id": "...",
    "status": "running",
    ...
  }
}
```

**Kết quả khi hoàn thành**:
```json
{
  "job": {
    "id": "...",
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
    "id": "...",
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

**Lưu ý**: Poll endpoint này mỗi 2-5 giây cho đến khi `status` là `success` hoặc `failed`

### 8.3 Download PDF Artifact

**Endpoint**: `GET /api/v1/projects/{projectId}/compile/{jobId}/artifact`

**Chỉ khi job status = "success"!**

1. Click **"Try it out"**
2. Nhập `projectId` và `jobId`
3. Click **"Execute"**
4. Click **"Download file"** để tải PDF

**Hoặc mở trực tiếp trong trình duyệt**:
```
http://localhost:3000/api/v1/projects/{projectId}/compile/{jobId}/artifact
```

**Kết quả**: File PDF tải về, mở được và hiển thị nội dung

---

## Bước 9: Test Error Cases

### 9.1 Test với Project Có Lỗi

Sử dụng project `test-error-project` để test error handling:

1. Compile project này: `POST /api/v1/projects/test-error-project/compile`
2. Check status: Job sẽ chuyển sang `failed`
3. Xem diagnostics trong response để thấy lỗi cú pháp

### 9.2 Test Unauthorized Access

1. Click nút **"Authorize"** và click **"Logout"**
2. Thử gọi bất kỳ endpoint nào
3. **Kết quả**: Status 401 Unauthorized

### 9.3 Test Not Found

1. Thử get project không tồn tại: `GET /api/v1/projects/00000000-0000-0000-0000-000000000000`
2. **Kết quả**: Status 404 Not Found

---

## Test Projects Có Sẵn

Sau khi chạy `npm run seed:projects`, bạn có 5 projects để test:

### 1. Tài Liệu Đơn Giản
- **ID**: `test-simple-project`
- **Mô tả**: Document đơn giản, compile nhanh
- **Dùng để**: Test basic compile flow

### 2. Tài Liệu Toán Học
- **ID**: `test-math-project`
- **Mô tả**: Document với công thức toán học
- **Dùng để**: Test math rendering

### 3. Khóa Luận Tốt Nghiệp
- **ID**: `test-thesis-project`
- **Mô tả**: Template khóa luận với formatting
- **Dùng để**: Test complex document

### 4. Tài Liệu Có Lỗi (Test)
- **ID**: `test-error-project`
- **Mô tả**: Document có lỗi cú pháp
- **Dùng để**: Test error handling

### 5. Giáo Trình Typst
- **ID**: `test-teacher-project`
- **Mô tả**: Teacher's project
- **Dùng để**: Test teacher role

---

## Workflow Test Đầy Đủ

### Scenario 1: Happy Path (Compile Thành Công)

1. ✅ Login → Get token
2. ✅ Authorize Swagger
3. ✅ List projects → Get project ID
4. ✅ Get project details
5. ✅ List files → Verify main.typ exists
6. ✅ Get settings → Verify mainPath
7. ✅ Compile → Get job ID
8. ✅ Poll status → Wait for success
9. ✅ Download PDF → Verify content

### Scenario 2: Error Handling

1. ✅ Login → Get token
2. ✅ Authorize Swagger
3. ✅ Compile error project → Get job ID
4. ✅ Poll status → Wait for failed
5. ✅ Check diagnostics → Verify error messages

### Scenario 3: File Management

1. ✅ Login → Get token
2. ✅ Create project
3. ✅ Create file → main.typ
4. ✅ Update file → Change content
5. ✅ Compile → Verify new content
6. ✅ Create another file → chapter1.typ
7. ✅ Update settings → Change mainPath to chapter1.typ
8. ✅ Compile → Verify compiles chapter1.typ

---

## Troubleshooting

### Lỗi 401 Unauthorized
**Nguyên nhân**: Token hết hạn hoặc không đúng  
**Giải pháp**: Login lại và authorize lại

### Lỗi 404 Not Found
**Nguyên nhân**: Project ID hoặc file path không tồn tại  
**Giải pháp**: Kiểm tra lại ID/path, chạy seed lại nếu cần

### Compile Job Stuck ở "queued"
**Nguyên nhân**: Worker không chạy  
**Giải pháp**: 
1. Kiểm tra `.env`: `COMPILE_WORKER_ENABLED=true`
2. Restart server
3. Kiểm tra logs có dòng "Compile worker started"

### PDF Không Tải Được
**Nguyên nhân**: Job chưa hoàn thành hoặc thất bại  
**Giải pháp**: 
1. Check job status trước
2. Chỉ download khi status = "success"
3. Nếu status = "failed", xem diagnostics

---

## Tips & Tricks

### 1. Sử Dụng Swagger Schema

Swagger tự động validate request body theo schema. Nếu bạn nhập sai format, nó sẽ báo lỗi ngay.

### 2. Copy-Paste IDs

Luôn copy ID từ response để dùng cho request tiếp theo. Đừng gõ tay!

### 3. Poll Compile Status

Compile có thể mất 2-10 giây. Đừng spam request, đợi 2-3 giây giữa mỗi lần poll.

### 4. Test Nhiều Roles

Test với cả student, teacher, và admin để verify authorization.

### 5. Xem Response Schema

Click vào "Schema" tab trong mỗi endpoint để xem cấu trúc response.

---

## Quick Reference

### Login Credentials
```
Student: 2251172560@e.tlu.edu.vn / 123456
Teacher: kieutuandung@tlu.edu.vn / 123456
Admin: admin@tlu.edu.vn / 123456
```

### Test Project IDs
```
test-simple-project    - Simple document
test-math-project      - Math formulas
test-thesis-project    - Thesis template
test-error-project     - Error handling
test-teacher-project   - Teacher's project
```

### Important Endpoints
```
POST   /api/v1/auth/login
GET    /api/v1/projects
GET    /api/v1/projects/{id}
GET    /api/v1/projects/{id}/files
GET    /api/v1/projects/{id}/settings
POST   /api/v1/projects/{id}/compile
GET    /api/v1/projects/{id}/compile/{jobId}
GET    /api/v1/projects/{id}/compile/{jobId}/artifact
```

---

## Kết Luận

Swagger UI là công cụ tuyệt vời để test API! Với seed data đã chuẩn bị, bạn có thể:
- ✅ Test tất cả endpoints
- ✅ Verify request/response format
- ✅ Test error cases
- ✅ Download PDF artifacts
- ✅ Explore API documentation

**Happy Testing!** 🚀
