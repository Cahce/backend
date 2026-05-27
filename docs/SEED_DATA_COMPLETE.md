# Seed Data Creation Complete

**Ngày**: 2026-05-05  
**Trạng thái**: ✅ Hoàn thành

---

## Tóm Tắt

Đã tạo xong các seed scripts và tài liệu hướng dẫn để test API trên Swagger UI.

---

## Files Đã Tạo

### 1. Seed Scripts

#### `scripts/seed-test-projects.ts`
- Tạo 5 test projects với Typst files
- Mỗi project có mục đích test khác nhau
- Sử dụng upsert để tránh duplicate

#### `scripts/seed-users.ts` (đã có)
- Tạo 3 users: admin, teacher, student
- Password mặc định: `123456`

#### `scripts/seed-admin-data.ts` (đã có)
- Tạo academic data: faculties, departments, majors, classes
- Tạo 5 teachers và 5 students với accounts

### 2. NPM Scripts

Đã thêm vào `package.json`:
```json
{
  "seed:users": "tsx scripts/seed-users.ts",
  "seed:admin": "tsx scripts/seed-admin-data.ts",
  "seed:projects": "tsx scripts/seed-test-projects.ts",
  "seed:all": "npm run seed:users && npm run seed:admin && npm run seed:projects"
}
```

### 3. Documentation

#### `docs/SWAGGER_TESTING_GUIDE.md`
- Hướng dẫn chi tiết test API trên Swagger UI
- Step-by-step instructions
- Test scenarios và workflows
- Troubleshooting guide
- Quick reference

---

## Test Projects

Sau khi chạy `npm run seed:projects`, bạn sẽ có 5 projects:

### 1. Tài Liệu Đơn Giản
- **ID**: `test-simple-project`
- **Owner**: Student (2251172560@e.tlu.edu.vn)
- **Category**: report
- **File**: `main.typ` - Document đơn giản với tiêu đề, mục, nội dung
- **Mục đích**: Test basic compile flow

### 2. Tài Liệu Toán Học
- **ID**: `test-math-project`
- **Owner**: Student (2251172560@e.tlu.edu.vn)
- **Category**: report
- **File**: `main.typ` - Document với công thức toán học, tích phân, ma trận
- **Mục đích**: Test math rendering

### 3. Khóa Luận Tốt Nghiệp
- **ID**: `test-thesis-project`
- **Owner**: Student (2251172560@e.tlu.edu.vn)
- **Category**: thesis
- **File**: `main.typ` - Template khóa luận với formatting, trang bìa, chương
- **Mục đích**: Test complex document with formatting

### 4. Tài Liệu Có Lỗi (Test)
- **ID**: `test-error-project`
- **Owner**: Student (2251172560@e.tlu.edu.vn)
- **Category**: report
- **File**: `main.typ` - Document có lỗi cú pháp (thiếu toán hạng, hàm không tồn tại, biến undefined)
- **Mục đích**: Test error handling và diagnostics

### 5. Giáo Trình Typst
- **ID**: `test-teacher-project`
- **Owner**: Teacher (kieutuandung@tlu.edu.vn)
- **Category**: other
- **File**: `main.typ` - Giáo trình hướng dẫn Typst
- **Mục đích**: Test teacher role

---

## Cách Sử Dụng

### Bước 1: Seed Dữ Liệu

```powershell
# Seed tất cả (recommended)
npm run seed:all

# Hoặc seed từng phần:
npm run seed:users      # Tạo users
npm run seed:admin      # Tạo academic data
npm run seed:projects   # Tạo test projects
```

**Kết quả**:
```
🌱 Starting test projects seeding...

✅ Found users:
   - Student: 2251172560@e.tlu.edu.vn
   - Teacher: kieutuandung@tlu.edu.vn

📁 Creating Simple Project...
✅ Created: Tài Liệu Đơn Giản
   - ID: test-simple-project
   - Files: main.typ

📁 Creating Math Project...
✅ Created: Tài Liệu Toán Học
   - ID: test-math-project
   - Files: main.typ

📁 Creating Thesis Project...
✅ Created: Khóa Luận Tốt Nghiệp
   - ID: test-thesis-project
   - Files: main.typ

📁 Creating Error Project...
✅ Created: Tài Liệu Có Lỗi (Test)
   - ID: test-error-project
   - Files: main.typ

📁 Creating Teacher Project...
✅ Created: Giáo Trình Typst
   - ID: test-teacher-project
   - Files: main.typ

📊 Seeding Summary:
   ✅ 5 test projects created
   ✅ 5 Typst files created

✨ Test projects seeding completed successfully!
```

### Bước 2: Khởi Động Server

```powershell
npm run dev
```

**Kiểm tra**: Server chạy tại `http://localhost:3000`

### Bước 3: Test Trên Swagger UI

Mở trình duyệt: `http://localhost:3000/docs`

**Đọc hướng dẫn chi tiết**: `docs/SWAGGER_TESTING_GUIDE.md`

---

## Quick Start Guide

### 1. Login

**Endpoint**: `POST /api/v1/auth/login`

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

**Copy `accessToken` từ response**

### 2. Authorize

1. Click nút **"Authorize"** (góc trên bên phải)
2. Nhập: `Bearer <accessToken>`
3. Click **"Authorize"** → **"Close"**

### 3. Test Projects API

**List all projects**: `GET /api/v1/projects`
```json
{
  "projects": [
    {
      "id": "test-simple-project",
      "title": "Tài Liệu Đơn Giản",
      ...
    },
    ...
  ]
}
```

**Get project details**: `GET /api/v1/projects/test-simple-project`

### 4. Test Files API

**List files**: `GET /api/v1/projects/test-simple-project/files`

**Get file content**: `GET /api/v1/projects/test-simple-project/files/main.typ`

### 5. Test Compile API

**Enqueue compile**: `POST /api/v1/projects/test-simple-project/compile`
```json
{
  "entryPath": "main.typ"
}
```

**Response**: Copy `job.id`

**Check status**: `GET /api/v1/projects/test-simple-project/compile/{jobId}`

**Poll mỗi 2-3 giây** cho đến khi `status` = `"success"`

**Download PDF**: `GET /api/v1/projects/test-simple-project/compile/{jobId}/artifact`

---

## Test Scenarios

### Scenario 1: Happy Path (Compile Thành Công)

1. ✅ Login → Get token
2. ✅ Authorize Swagger
3. ✅ List projects → Get `test-simple-project`
4. ✅ Get project details
5. ✅ List files → Verify `main.typ` exists
6. ✅ Get settings → Verify `mainPath = "main.typ"`
7. ✅ Compile → Get job ID
8. ✅ Poll status → Wait for `status = "success"`
9. ✅ Download PDF → Verify content

**Kết quả**: PDF file tải về, mở được, hiển thị nội dung đúng

### Scenario 2: Error Handling

1. ✅ Login → Get token
2. ✅ Authorize Swagger
3. ✅ Compile `test-error-project` → Get job ID
4. ✅ Poll status → Wait for `status = "failed"`
5. ✅ Check diagnostics → Verify error messages

**Kết quả**: Job failed với diagnostics chứa lỗi cú pháp

### Scenario 3: File Management

1. ✅ Login → Get token
2. ✅ Create new project
3. ✅ Create file `main.typ` (POST)
4. ✅ Update file content (PUT)
5. ✅ Compile → Verify new content
6. ✅ Create another file `chapter1.typ`
7. ✅ Update settings → Change `mainPath` to `chapter1.typ`
8. ✅ Compile → Verify compiles `chapter1.typ`

**Kết quả**: File management và compile flow hoạt động đúng

---

## Login Credentials

### Users

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@tlu.edu.vn | 123456 |
| Teacher | kieutuandung@tlu.edu.vn | 123456 |
| Student | 2251172560@e.tlu.edu.vn | 123456 |

### Test Projects

| Project ID | Title | Owner | Category |
|------------|-------|-------|----------|
| test-simple-project | Tài Liệu Đơn Giản | Student | report |
| test-math-project | Tài Liệu Toán Học | Student | report |
| test-thesis-project | Khóa Luận Tốt Nghiệp | Student | thesis |
| test-error-project | Tài Liệu Có Lỗi (Test) | Student | report |
| test-teacher-project | Giáo Trình Typst | Teacher | other |

---

## Important Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/logout` - Logout
- `POST /api/v1/auth/refresh` - Refresh token

### Projects
- `GET /api/v1/projects` - List all projects
- `POST /api/v1/projects` - Create project
- `GET /api/v1/projects/{id}` - Get project details
- `PUT /api/v1/projects/{id}` - Update project
- `DELETE /api/v1/projects/{id}` - Delete project

### Files
- `GET /api/v1/projects/{projectId}/files` - List files
- `POST /api/v1/projects/{projectId}/files` - Create file
- `GET /api/v1/projects/{projectId}/files/*` - Get file content
- `PUT /api/v1/projects/{projectId}/files/*` - Update file
- `DELETE /api/v1/projects/{projectId}/files/*` - Delete file

### Settings
- `GET /api/v1/projects/{id}/settings` - Get settings
- `PUT /api/v1/projects/{id}/settings` - Update settings

### Compile
- `POST /api/v1/projects/{id}/compile` - Enqueue compile job
- `GET /api/v1/projects/{projectId}/compile/{jobId}` - Check status
- `GET /api/v1/projects/{projectId}/compile/{jobId}/artifact` - Download PDF

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
2. Chỉ download khi `status = "success"`
3. Nếu `status = "failed"`, xem diagnostics

### Seed Script Báo Lỗi "Required users not found"
**Nguyên nhân**: Chưa chạy `seed:users`  
**Giải pháp**: Chạy `npm run seed:users` trước, sau đó chạy `npm run seed:projects`

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

### 6. Re-seed Khi Cần
Nếu data bị lỗi, chạy lại `npm run seed:all` để reset về trạng thái ban đầu.

---

## Next Steps

1. ✅ Chạy `npm run seed:all` để tạo dữ liệu test
2. ✅ Khởi động server: `npm run dev`
3. ✅ Mở Swagger UI: `http://localhost:3000/docs`
4. ✅ Đọc hướng dẫn chi tiết: `docs/SWAGGER_TESTING_GUIDE.md`
5. ✅ Test các endpoints theo scenarios
6. ✅ Verify compile flow hoạt động đúng

---

## Files Created

1. ✅ `scripts/seed-test-projects.ts` - Seed script
2. ✅ `docs/SWAGGER_TESTING_GUIDE.md` - Testing guide
3. ✅ `docs/SEED_DATA_COMPLETE.md` - This document
4. ✅ `package.json` - Updated with seed scripts

---

## References

- **Testing Guide**: `docs/SWAGGER_TESTING_GUIDE.md` (chi tiết nhất)
- **Compile API Test**: `docs/TEST_COMPILE_API_RESULTS.md`
- **Seed Scripts**: `scripts/seed-*.ts`
- **Swagger UI**: `http://localhost:3000/docs`

---

## Kết Luận

✅ Seed data đã được tạo xong!  
✅ Documentation đã được viết chi tiết!  
✅ Bạn có thể bắt đầu test API trên Swagger UI ngay!

**Happy Testing!** 🚀
