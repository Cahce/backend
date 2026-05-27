# Templates Backend - Quick Start Guide

## Status: ✅ COMPLETE & READY

The Templates backend module is **fully implemented** and ready to use.

---

## Quick Verification

```powershell
cd d:\DATN\code\backend

# 1. Build check
npm run build
# ✅ Should complete without errors

# 2. Run unit tests
npm run test:unit:templates
# ✅ Should show: 28 tests pass, 0 fail

# 3. Start server
npm run dev
# ✅ Server should start on port 3000
# ✅ Swagger UI available at http://localhost:3000/docs
```

---

## Available Endpoints

### Admin Routes (requires admin role)

**Base**: `/api/v1/admin/templates`

```
POST   /templates                              # Create template
GET    /templates                              # List all (with filters)
GET    /templates/:id                          # Get by ID
PATCH  /templates/:id                          # Update
DELETE /templates/:id                          # Delete
POST   /templates/:id/versions                 # Upload version
GET    /templates/:id/versions                 # List versions
PATCH  /templates/:id/versions/:versionId      # Deactivate version
GET    /templates/:id/versions/:versionId/download  # Download
```

### Public Routes (requires login)

**Base**: `/api/v1/templates`

```
GET    /templates        # List active templates with latest version
GET    /templates/:id    # Get template by ID (active only)
```

---

## Testing the API

### 1. Get Admin Token

```bash
# Login as admin
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@tlu.edu.vn",
    "password": "admin123"
  }'

# Save the token from response
export TOKEN="<your-token-here>"
```

### 2. Create a Template

```bash
curl -X POST http://localhost:3000/api/v1/admin/templates \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Test Template",
    "description": "A test template",
    "category": "thesis",
    "isOfficial": false
  }'
```

### 3. Upload Template Version

```bash
# Create a simple .typ file
echo "#heading[Test Template]" > test.typ

# Upload it
curl -X POST http://localhost:3000/api/v1/admin/templates/<template-id>/versions \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.typ" \
  -F "versionNumber=v1.0.0" \
  -F "changelog=Initial version"
```

### 4. List Public Templates

```bash
curl -X GET http://localhost:3000/api/v1/templates \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Create Project from Template

```bash
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Project",
    "category": "thesis",
    "templateVersionId": "<version-id>"
  }'
```

---

## Seed Data

Run seed to create 3 official templates:

```powershell
npx prisma db seed
```

This creates:
1. **Mẫu Luận Văn Khóa 2024** (thesis)
2. **Mẫu Báo Cáo Thực Tập** (report)
3. **Mẫu Đề Cương Nghiên Cứu** (proposal)

---

## Swagger UI

Open http://localhost:3000/docs to see:
- All template endpoints
- Request/response schemas
- Try out the API directly

---

## Running Tests

```powershell
# Unit tests only
npm run test:unit:templates

# API tests (requires running server)
npm run test:api:templates:admin
npm run test:api:templates:public

# All template tests
npm run test:api:templates
```

---

## File Structure

```
src/modules/templates/
├── domain/
│   ├── Types.ts          # Domain entities and types
│   ├── Ports.ts          # Repository and storage interfaces
│   └── Errors.ts         # Domain errors
├── application/
│   ├── CreateTemplateUseCase.ts
│   ├── CreateTemplateVersionUseCase.ts
│   ├── MaterializeTemplateVersionUseCase.ts
│   └── ... (other use cases)
├── infra/
│   ├── TemplateRepoPrisma.ts      # Prisma repository
│   └── TemplateStorageFs.ts       # Filesystem storage
├── delivery/http/
│   ├── Admin/
│   │   ├── Routes.ts     # Admin routes
│   │   └── Dto.ts        # Admin DTOs
│   ├── Public/
│   │   ├── Routes.ts     # Public routes
│   │   └── Dto.ts        # Public DTOs
│   └── Routes.ts         # Route registration
├── __tests__/            # Unit tests
└── Container.ts          # DI container
```

---

## Environment Variables

Add to `.env`:

```env
# Template Storage
TEMPLATE_STORAGE_DIR=./storage/templates
```

---

## Common Issues

### Issue: "Template not found"
**Solution**: Make sure you're using the correct template ID from the create response.

### Issue: "Version already exists"
**Solution**: Use a different version number (e.g., v1.0.1, v1.1.0).

### Issue: "File too large"
**Solution**: Files must be < 10 MB total, < 5 MB per file.

### Issue: "Invalid archive"
**Solution**: ZIP files must contain `main.typ` at the root level.

### Issue: "Template in use"
**Solution**: Cannot delete templates that are used by projects. Deactivate instead.

---

## Next Steps for Frontend

1. **Admin UI** (`/admin/templates`):
   - List templates with filters
   - Create/edit/delete templates
   - Upload versions
   - Manage active/inactive status

2. **User UI** (project creation):
   - Show template gallery
   - Preview template info
   - Select template when creating project

3. **Integration**:
   - Add `templateVersionId` to project creation form
   - Backend automatically seeds files from template

---

## Support

- **Spec**: `.kiro/specs/templates-backend/`
- **Status**: `.kiro/specs/templates-backend/IMPLEMENTATION_STATUS.md`
- **Tests**: `src/modules/templates/__tests__/`
- **API Tests**: `scripts/test-templates-*.ts`

---

**Status**: ✅ All systems operational. Ready for frontend integration.

