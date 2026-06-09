# Database ER Diagram

## Tổng quan

Biểu đồ Entity-Relationship (ER) cho hệ thống TLU Scholar Editor được tạo tự động từ Prisma schema.

## Files

- **database-erd.svg** - Biểu đồ ER đầy đủ (auto-generated)

## Cách xem

### Option 1: Mở trực tiếp
Mở file `database-erd.svg` trong trình duyệt hoặc image viewer

### Option 2: VS Code
- Cài extension "SVG" hoặc "SVG Preview"
- Click vào file để xem

### Option 3: Online
Kéo thả file vào:
- https://www.svgviewer.dev/
- https://svgviewer.online/

## Cấu trúc Database

### Core Entities

#### Users & Authentication
- **User** - Người dùng hệ thống (admin, student, teacher)
- **Teacher** - Hồ sơ giáo viên
- **Student** - Hồ sơ sinh viên
- **InvalidToken** - JWT blacklist
- **RefreshToken** - Refresh token rotation

#### Academic Structure
- **Faculty** - Khoa
- **Department** - Bộ môn
- **Major** - Ngành học
- **Class** - Lớp học

#### Projects & Files
- **Project** - Dự án Typst
- **ProjectSettings** - Cấu hình dự án
- **ProjectMember** - Thành viên dự án
- **ProjectShareLink** - Link chia sẻ
- **ProjectAdvisor** - Giảng viên hướng dẫn
- **File** - Files trong project (text + binary)

#### Templates
- **Template** - Mẫu dự án
- **TemplateVersion** - Phiên bản mẫu

#### Compilation
- **CompileJob** - Công việc biên dịch
- **CompileArtifact** - Kết quả biên dịch (PDF)

#### Bibliography Integration
- **ZoteroConnection** - Kết nối Zotero
- **ZoteroSyncLog** - Lịch sử đồng bộ Zotero
- **OpenAlexImportLog** - Log import từ OpenAlex

#### Analytics & Snapshots
- **ProjectSnapshot** - Snapshot cho collaboration
- **ProjectWordCountSnapshot** - Thống kê word count
- **UserQuota** - Quota lưu trữ

## Relationships Chính

### User-centric
```
User 1--0..1 Teacher (via accountId)
User 1--0..1 Student (via accountId)
User 1--* Project (owner)
User 1--* ProjectMember
User 1--* ZoteroConnection
```

### Academic Hierarchy
```
Faculty 1--* Department
Faculty 1--* Major
Major 1--* Class
Department 1--* Teacher
Class 1--* Student
```

### Project Structure
```
Project 1--0..1 ProjectSettings
Project 1--* File
Project 1--* CompileJob
Project 1--* CompileArtifact
Project 1--* ProjectMember
Project 1--* ProjectAdvisor (via Teacher)
Project *--0..1 Template
Project *--0..1 TemplateVersion
```

### Template System
```
Template 1--* TemplateVersion
Template 0..1--0..1 Project (sourceProject)
```

### Compilation Pipeline
```
CompileJob *--1 Project
CompileJob 1--* CompileArtifact (produced artifacts)
CompileJob 1--0..1 CompileArtifact (latest artifact)
```

## Enums

### CompileStatus
- `queued` - Đang chờ
- `running` - Đang chạy
- `success` - Thành công
- `failed` - Thất bại

### UserRole
- `admin` - Quản trị viên
- `student` - Sinh viên
- `teacher` - Giảng viên

### ProjectRole
- `editor` - Có quyền chỉnh sửa
- `viewer` - Chỉ xem

### FileKind
- `typst` - Typst source
- `bib` - Bibliography
- `image` - Raster images
- `vector` - Vector graphics
- `font` - Font files
- `pdf` - PDF documents
- `other` - Other files

### TemplateCategory
- `thesis` - Luận văn
- `report` - Báo cáo
- `proposal` - Đề cương
- `paper` - Bài báo
- `presentation` - Bài thuyết trình
- `other` - Khác

## Cập nhật Diagram

Khi schema thay đổi, chạy:

```powershell
cd backend
npx prisma generate
```

Diagram sẽ tự động được regenerate tại `docs/diagrams/class/database-erd.svg`

## Generator Configuration

```prisma
generator erd {
  provider = "prisma-erd-generator"
  output   = "../docs/diagrams/class/database-erd.svg"
  theme    = "neutral"
}
```

### Theme Options
- `default` - Mermaid default theme
- `neutral` - Neutral colors (hiện tại)
- `dark` - Dark theme
- `forest` - Forest theme

Để thay đổi theme, sửa trong `prisma/schema.prisma` rồi chạy `npx prisma generate`

## Key Features

### Cascade Deletes
- Xóa User → SetNull cho Teacher/Student accountId
- Xóa Project → Cascade xóa Files, CompileJobs, Settings
- Xóa Template → Cascade xóa TemplateVersions

### Unique Constraints
- Email unique per User
- StudentCode, TeacherCode unique
- Faculty/Department/Major/Class codes unique
- ProjectMember unique per (projectId, userId)

### Indexes
- Performance indexes trên foreign keys
- Composite indexes cho queries thường dùng
- Created/Updated timestamp indexes

## Lưu ý Quan trọng

1. **Teacher/Student Independence**: Teacher và Student có thể tồn tại độc lập mà không cần account (accountId nullable)

2. **Soft References**: Owner relationships dùng SetNull để preserve data khi user bị xóa

3. **Binary Files**: File model hỗ trợ cả text (textContent) và binary (storageKey) storage

4. **Template Authoring**: Template có thể link đến một sourceProject để làm working copy cho việc authoring

5. **Compilation**: CompileJob có quan hệ bidirectional với CompileArtifact (latest artifact)
