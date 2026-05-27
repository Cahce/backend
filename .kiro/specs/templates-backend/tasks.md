# Tasks — Templates module (Backend)

Thứ tự: từ schema/infra ra ngoài delivery rồi đến tích hợp cross-module và seed/test. Không bỏ qua dependency direction (delivery → application → domain; infra implements ports).

> Quy ước verification: mọi task có acceptance kết thúc bằng câu lệnh PowerShell trong `D:\DATN\code\backend`. Khi gắn label `[blocks frontend]` thì frontend spec phụ thuộc — phải xong task này trước khi frontend FE-N tương ứng có thể bắt đầu.

---

## T1. Schema migration cho `entryPath`

**Intent**: Thêm cột `entryPath` (default `main.typ`) cho `TemplateVersion` để hỗ trợ archive nhiều file.
**Files**:
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/<timestamp>_add_template_version_entry_path/migration.sql` (Prisma sinh)

**Acceptance**: `npx prisma migrate dev --name add_template_version_entry_path` chạy thành công local; cột `entryPath` xuất hiện trong DB.

**Verify**:
```powershell
cd backend
npx prisma migrate status
npm run build
```

---

## T2. Domain layer

**Intent**: Tạo entities, errors, ports cho module mới.
**Files**:
- `backend/src/modules/templates/domain/Template.ts`
- `backend/src/modules/templates/domain/TemplateVersion.ts`
- `backend/src/modules/templates/domain/Errors.ts` — `TemplateNotFoundError`, `TemplateInUseError`, `VersionExistsError`, `InvalidArchiveError`, `VersionNotFoundError`
- `backend/src/modules/templates/domain/Ports.ts` — `TemplateRepo`, `TemplateStorageGateway`, type `MaterializeTemplate`

**Acceptance**: TypeScript compile sạch. Không phụ thuộc Fastify/Prisma.

**Verify**:
```powershell
cd backend
npm run build
```

---

## T3. Infra: `TemplateRepoPrisma`

**Intent**: Implement `TemplateRepo` bằng Prisma client.
**Files**: `backend/src/modules/templates/infra/TemplateRepoPrisma.ts`

**Acceptance**:
- Tất cả method trả entity domain (không lộ Prisma type ra ngoài).
- `countProjectsUsing(id)` đếm `Project.templateId = id` HOẶC `Project.templateVersionId IN (versions của template)`.
- `listPublic()` chỉ trả template `isActive=true` kèm `latestVersion` (version `isActive=true` mới nhất theo `createdAt DESC`); template không có version active bị loại.

**Verify**:
```powershell
cd backend
npm run build
```

---

## T4. Infra: `TemplateStorageFs`

**Intent**: Implement `TemplateStorageGateway` bằng filesystem local. Hỗ trợ archive `.typ` (1 file) và `.zip` (extract).
**Files**:
- `backend/src/modules/templates/infra/TemplateStorageFs.ts`
- `backend/src/config/index.ts` — thêm env `TEMPLATE_STORAGE_DIR` (default `./storage/templates`)
- `backend/.env.example` — thêm `TEMPLATE_STORAGE_DIR=./storage/templates`

**Acceptance**:
- `writeArchive` reject zip có entry path traversal (`..`, absolute) → throw `InvalidArchiveError`.
- `writeArchive` reject zip > 10 MB tổng / single entry > 5 MB.
- `readFiles(storageKey)` trả list `{ path, content }` cho mọi file `.typ`, `.bib`, `.csv` (text formats); bỏ qua binary.
- `remove(storageKey)` đệ quy xóa `<TEMPLATE_STORAGE_DIR>/<storageKey>`.

**Verify**:
```powershell
cd backend
npm run test:unit:templates -- TemplateStorageFs
```

(Test file sẽ tạo trong T11.)

---

## T5. Application: use cases CRUD

**Intent**: Use case orchestration — không chứa logic persistence.
**Files**:
- `backend/src/modules/templates/application/CreateTemplateUseCase.ts`
- `.../ListTemplatesUseCase.ts` (admin filter + paginate)
- `.../GetTemplateByIdUseCase.ts`
- `.../UpdateTemplateUseCase.ts`
- `.../DeleteTemplateUseCase.ts` — gọi `countProjectsUsing` trước, throw `TemplateInUseError` nếu > 0
- `.../ListPublicTemplatesUseCase.ts`

**Acceptance**: Type-check pass; mỗi use case nhận deps qua constructor (không import infra trực tiếp).

**Verify**:
```powershell
cd backend
npm run build
```

---

## T6. Application: use cases Version

**Intent**: Quản lý version + materialize.
**Files**:
- `.../application/CreateTemplateVersionUseCase.ts` — nhận `archive: AsyncIterable<Buffer>`, `archiveType`, validate `versionNumber` regex, gọi `storage.writeArchive` → `repo.createVersion`. Rollback nếu repo fail (gọi `storage.remove`).
- `.../application/DeactivateTemplateVersionUseCase.ts`
- `.../application/DownloadTemplateVersionUseCase.ts` — trả `AsyncIterable<Buffer>` (zip lại từ files)
- `.../application/MaterializeTemplateVersionUseCase.ts` — input `versionId`, validate `isActive=true`, throw `InvalidTemplateVersionError` nếu không, return `Array<{ path, content }>`

**Acceptance**:
- `MaterializeTemplateVersionUseCase` thỏa interface `MaterializeTemplate` định nghĩa ở `domain/Ports.ts`.

**Verify**:
```powershell
cd backend
npm run build
```

---

## T7. Container DI

**Intent**: Wire repo/storage/use cases.
**Files**: `backend/src/modules/templates/Container.ts`

```ts
export function createTemplatesContainer(deps: { prisma: PrismaClient; config: AppConfig }) {
  const repo = new TemplateRepoPrisma(deps.prisma);
  const storage = new TemplateStorageFs(deps.config.templateStorageDir);
  const useCases = {
    createTemplate: new CreateTemplateUseCase(repo),
    // ...
    materializeTemplateVersion: new MaterializeTemplateVersionUseCase(repo, storage),
  };
  return { useCases, materializeTemplateVersion: useCases.materializeTemplateVersion.execute.bind(useCases.materializeTemplateVersion) };
}
```

**Acceptance**: Type-check pass.

---

## T8. Delivery — Admin routes & DTO

**Intent**: Fastify routes + Zod DTO + OpenAPI.
**Files**:
- `backend/src/modules/templates/delivery/http/Admin/Dto.ts`
- `backend/src/modules/templates/delivery/http/Admin/Routes.ts`

**Routes**: theo bảng §2.1 design.md. PreHandler `app.auth.requireAdmin`. Các route upload dùng `app.register(multipart)` (đăng ký 1 lần ở plugin order — task T10).

**Acceptance** [blocks frontend FE-2..FE-5]:
- Mọi route trả đúng status (`201`, `200`, `204`, `400`, `403`, `404`, `409`, `413`).
- Schema lỗi đúng `{ error: { code, message } }`.
- Multer/multipart parse đúng field `file`.
- Swagger UI `/docs` hiển thị đầy đủ.

**Verify**:
```powershell
cd backend
npm run build
npm run dev
# trong tab khác:
curl -X POST http://localhost:3000/api/v1/admin/templates -H "Authorization: Bearer <admin>" -H "Content-Type: application/json" -d "{\"name\":\"T1\",\"category\":\"thesis\"}"
```

---

## T9. Delivery — Public routes & DTO

**Intent**: Read-only cho user đã login.
**Files**:
- `backend/src/modules/templates/delivery/http/Public/Dto.ts`
- `backend/src/modules/templates/delivery/http/Public/Routes.ts`

**Routes**: §2.2. PreHandler `app.auth.verify`.

**Acceptance** [blocks frontend FE-6]:
- `GET /api/v1/templates` trả `{ templates: PublicTemplateResponse[] }` chỉ active.
- `GET /api/v1/templates/:id` trả 404 nếu không active hoặc không tồn tại.

**Verify**: `curl` với token student trả mảng templates active.

---

## T10. Đăng ký module + multipart vào `app.ts`

**Intent**: Wire vào root app.
**Files**:
- `backend/src/app.ts`
- `backend/package.json` — thêm `@fastify/multipart` nếu chưa có.

**Acceptance**:
- Plugin order: config → cors → prisma → jwt → swagger → multipart → routes (templates đăng ký sau projects).
- `npm run build` & `npm run dev` chạy được.

**Verify**:
```powershell
cd backend
npm run build
npm run test:api:health
```

---

## T11. Unit tests

**Intent**: Cover use case + storage edge cases.
**Files**:
- `backend/tests/unit/templates/CreateTemplate.spec.ts`
- `backend/tests/unit/templates/DeleteTemplate.spec.ts` — assert `TemplateInUseError` khi có project liên kết
- `backend/tests/unit/templates/CreateTemplateVersion.spec.ts` — assert `VersionExistsError`, `InvalidArchiveError` (zip path traversal, oversize)
- `backend/tests/unit/templates/MaterializeTemplateVersion.spec.ts` — đọc 2-3 file giả từ in-memory storage gateway
- `backend/package.json` — script `"test:unit:templates": "vitest run tests/unit/templates"`

**Acceptance**:
```powershell
cd backend
npm run test:unit:templates
```
→ tất cả pass.

---

## T12. API tests

**Intent**: E2E qua HTTP thật.
**Files**:
- `backend/tests/api/templates.admin.spec.ts`
- `backend/tests/api/templates.public.spec.ts`
- `backend/package.json` — script `"test:api:templates": "vitest run tests/api/templates"`

**Acceptance**: Khi backend đang chạy local + DB sạch:
```powershell
cd backend
npm run test:api:templates
```
→ pass. Test bao gồm: tạo admin → CRUD template → upload version `.zip` → student list → student tạo project với templateVersionId → kiểm tra File table được seed file `main.typ` đúng nội dung.

---

## T13. Cross-module: `projects` materialize template

**Intent**: Cho phép `POST /api/v1/projects` nhận `templateVersionId`.
**Files**:
- `backend/src/modules/projects/delivery/http/Project/Dto.ts` — thêm field optional vào `CreateProjectRequest`
- `backend/src/modules/projects/application/CreateProjectUseCase.ts` — call `materializeTemplate(versionId)` rồi seed `File` + `ProjectSettings.mainPath = entryPath`
- `backend/src/modules/projects/domain/Ports.ts` — thêm `MaterializeTemplate` type
- `backend/src/app.ts` — wire qua container như §6 design.md

**Acceptance** [blocks frontend FE-7]:
- Tạo project thành công với `templateVersionId` hợp lệ → DB có File rows + `ProjectSettings.mainPath`.
- Tạo project với `templateVersionId` không tồn tại / không active → 400 `INVALID_TEMPLATE_VERSION`.
- Tạo project KHÔNG có `templateVersionId` → giữ behavior cũ (project rỗng).

**Verify**:
```powershell
cd backend
npm run test:api:projects
npm run test:api:templates
```

---

## T14. Seed dữ liệu mẫu

**Intent**: 3 template official sẵn để demo.
**Files**:
- `backend/prisma/seed/templates.ts`
- `backend/prisma/seed/template-assets/thesis-k2024/main.typ`
- `backend/prisma/seed/template-assets/internship-report/main.typ`
- `backend/prisma/seed/template-assets/research-proposal/main.typ`
- `backend/prisma/seed.ts` — gọi `seedTemplates()` sau seed user/faculty

**Acceptance**: `npx prisma db seed` idempotent — chạy 2 lần liên tiếp không tạo template thứ 4. Dùng `findFirst({ where: { name } })` trước khi `create`.

**Verify**:
```powershell
cd backend
npx prisma db seed
psql $env:DATABASE_URL -c "SELECT name, isOfficial FROM \"Template\";"
```
→ thấy 3 dòng official.

---

## T15. Documentation

**Intent**: Mô tả ngắn ở README module + cập nhật steering.
**Files**:
- `backend/src/modules/templates/README.md` — chỉ vài dòng: cấu trúc, route prefix, env, link đến spec
- `.kiro/steering/backend-system-structure.md` — bảng "Registered Routes" thêm 2 dòng `/api/v1/admin/templates` và `/api/v1/templates`

**Acceptance**: Build pass. Steering reflect đúng route registration mới.

**Verify**:
```powershell
cd backend
npm run build
```

---

## Verification roll-up

Khi T1–T15 xong, chạy chuỗi sau từ root repo:

```powershell
cd backend
npm run build
npm run test:unit
npm run test:unit:templates
npm run test:api:templates
npm run test:api:projects
```

Tất cả phải pass trước khi frontend bắt đầu task FE-2 trở đi.
