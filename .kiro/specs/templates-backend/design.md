# Design — Templates module (Backend)

## 1. Tổng quan

Module mới `backend/src/modules/templates/` theo Clean Architecture giống `modules/admin/...` và `modules/projects`. Module expose 2 route groups:

- `/api/v1/admin/templates` — admin only (preHandler `app.auth.requireAdmin`)
- `/api/v1/templates` — yêu cầu đã đăng nhập (preHandler `app.auth.verify`)

Module export 1 use case dùng cross-module: `MaterializeTemplateVersionUseCase` — module `projects` import qua DI khi tạo project có `templateVersionId`.

```
backend/src/modules/templates/
  delivery/http/
    Routes.ts                   # đăng ký 2 sub-router (admin + public)
    Admin/
      Routes.ts                 # admin CRUD + versions
      Dto.ts                    # Zod schemas + JSON Schema
    Public/
      Routes.ts                 # GET /templates, GET /templates/:id
      Dto.ts
  application/
    CreateTemplateUseCase.ts
    ListTemplatesUseCase.ts          # admin variant: filter + pagination
    GetTemplateByIdUseCase.ts
    UpdateTemplateUseCase.ts
    DeleteTemplateUseCase.ts          # 409 if Project uses any version
    ListPublicTemplatesUseCase.ts    # active only + latestVersion
    CreateTemplateVersionUseCase.ts  # multipart upload → write storage
    DeactivateTemplateVersionUseCase.ts
    DownloadTemplateVersionUseCase.ts
    MaterializeTemplateVersionUseCase.ts  # ← exported, projects module consumes
  domain/
    Template.ts                 # entity + value objects
    TemplateVersion.ts
    Errors.ts                   # TemplateInUseError, VersionExistsError, ...
    Ports.ts                    # TemplateRepo, TemplateStorageGateway
  infra/
    TemplateRepoPrisma.ts
    TemplateStorageFs.ts        # filesystem gateway implementing Ports.TemplateStorageGateway
  Container.ts                  # DI wiring
```

Cross-module: `modules/projects/Container.ts` được sửa để inject `MaterializeTemplateVersionUseCase` (qua interface khai báo trong projects domain — projects KHÔNG import templates infra).

## 2. Routes

### 2.1 Admin

| Method | Path | Auth | Use case |
|---|---|---|---|
| POST | `/api/v1/admin/templates` | requireAdmin | CreateTemplate |
| GET | `/api/v1/admin/templates` | requireAdmin | ListTemplates (admin) |
| GET | `/api/v1/admin/templates/:id` | requireAdmin | GetTemplateById |
| PATCH | `/api/v1/admin/templates/:id` | requireAdmin | UpdateTemplate |
| DELETE | `/api/v1/admin/templates/:id` | requireAdmin | DeleteTemplate |
| POST | `/api/v1/admin/templates/:id/versions` | requireAdmin | CreateTemplateVersion (multipart) |
| GET | `/api/v1/admin/templates/:id/versions` | requireAdmin | ListVersionsByTemplate |
| PATCH | `/api/v1/admin/templates/:id/versions/:versionId` | requireAdmin | DeactivateTemplateVersion |
| GET | `/api/v1/admin/templates/:id/versions/:versionId/download` | requireAdmin | DownloadTemplateVersion (returns zip stream) |

### 2.2 Public

| Method | Path | Auth | Use case |
|---|---|---|---|
| GET | `/api/v1/templates` | verify | ListPublicTemplates |
| GET | `/api/v1/templates/:id` | verify | GetTemplateById (chỉ trả nếu `isActive=true`) |

## 3. DTO (Zod)

```ts
// Shared
export const TemplateCategoryEnum = z.enum([
  "thesis", "report", "proposal", "paper", "presentation", "other",
]);

// Create
export const CreateTemplateRequest = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: TemplateCategoryEnum,
  isOfficial: z.boolean().default(false),
});

// Update (all partial)
export const UpdateTemplateRequest = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  category: TemplateCategoryEnum.optional(),
  isOfficial: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// List query (admin)
export const ListTemplatesQuery = z.object({
  search: z.string().optional(),
  category: TemplateCategoryEnum.optional(),
  isOfficial: z.enum(["true", "false"]).optional(),
  isActive: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// Response shapes
export interface TemplateResponse {
  id: string;
  name: string;
  description: string | null;
  category: TemplateCategory;
  isOfficial: boolean;
  isActive: boolean;
  createdAt: string;     // ISO
  updatedAt: string;     // ISO
  versionCount: number;  // computed
}

export interface TemplateVersionResponse {
  id: string;
  templateId: string;
  versionNumber: string;
  changelog: string | null;
  isActive: boolean;
  createdAt: string;
  fileCount: number;     // computed; cho UI hiển thị "5 file"
}

// Public list response
export interface PublicTemplateResponse extends Omit<TemplateResponse, "isActive"> {
  latestVersion: {
    id: string;
    versionNumber: string;
    createdAt: string;
  } | null;
}

// Multipart create version
// Field name: "file" — single .typ hoặc .zip
// Field name: "versionNumber" — string
// Field name: "changelog" — string optional

// Error codes
//   TEMPLATE_NOT_FOUND, VERSION_NOT_FOUND
//   TEMPLATE_IN_USE          → 409, on DELETE
//   VERSION_EXISTS           → 409, on POST version với versionNumber trùng
//   INVALID_TEMPLATE_VERSION → 400, projects module bắn ra
//   FILE_TOO_LARGE           → 413
//   INVALID_ARCHIVE          → 400, zip không có main.typ ở root hoặc có path traversal
//   VALIDATION_ERROR         → 400, generic Zod
```

## 4. Domain

### 4.1 Entities

```ts
// domain/Template.ts
export class Template {
  constructor(
    public readonly id: string,
    public name: string,
    public description: string | null,
    public category: TemplateCategory,
    public isOfficial: boolean,
    public isActive: boolean,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  rename(next: string): void { ... }
  setActive(value: boolean): void { ... }
  // không cho phép rename về empty, vv.
}
```

### 4.2 Ports

```ts
// domain/Ports.ts
export interface TemplateRepo {
  create(input: CreateTemplateInput): Promise<Template>;
  findById(id: string): Promise<Template | null>;
  list(filter: TemplateFilter): Promise<{ items: Template[]; total: number }>;
  listPublic(): Promise<TemplateWithLatestVersion[]>;
  update(id: string, patch: TemplateUpdate): Promise<Template>;
  delete(id: string): Promise<void>;
  countProjectsUsing(id: string): Promise<number>;

  createVersion(input: CreateVersionInput): Promise<TemplateVersion>;
  findVersionById(versionId: string): Promise<TemplateVersion | null>;
  listVersionsByTemplate(templateId: string): Promise<TemplateVersion[]>;
  setVersionActive(versionId: string, isActive: boolean): Promise<TemplateVersion>;
}

export interface TemplateStorageGateway {
  // Phase 1: filesystem; chữ ký này không lộ filesystem details.
  writeArchive(input: {
    templateId: string;
    versionId: string;
    archive: AsyncIterable<Buffer>;        // multipart stream
    archiveType: "typ" | "zip";
  }): Promise<{ storageKey: string; fileCount: number }>;

  readFiles(storageKey: string): Promise<Array<{ path: string; content: string }>>;

  remove(storageKey: string): Promise<void>;
}
```

### 4.3 Errors

```ts
// domain/Errors.ts
export class TemplateNotFoundError extends DomainError { code = "TEMPLATE_NOT_FOUND"; }
export class TemplateInUseError extends DomainError { code = "TEMPLATE_IN_USE"; }
export class VersionExistsError extends DomainError { code = "VERSION_EXISTS"; }
export class InvalidArchiveError extends DomainError { code = "INVALID_ARCHIVE"; }
```

## 5. Storage layout

```
${TEMPLATE_STORAGE_DIR}/
  <templateId>/
    <versionId>/
      main.typ
      assets/
        logo.png
      ...
```

`storageKey` lưu trong DB là relative path `<templateId>/<versionId>` (không bao gồm root). `TemplateStorageFs.readFiles(storageKey)` resolve ngược lại đầy đủ và trả về list `{ path, content }` (text only — binary asset như ảnh sẽ không materialize ở phase 1 vì project File table hiện chỉ lưu text trong `textContent`; phase sau mở rộng).

Sanitize:

- Reject zip entry có `path` chứa `..`, bắt đầu bằng `/`, hoặc absolute Windows path.
- Reject zip entry > 5 MB / total > 10 MB (phòng zip bomb).

## 6. Cross-module integration với `projects`

Hiện tại `modules/projects/application/CreateProjectUseCase.ts` nhận `{ title, category }`. Spec mở rộng:

```ts
interface CreateProjectInput {
  title: string;
  category: TemplateCategory;
  templateVersionId?: string;   // mới
}
```

Trong `CreateProjectUseCase`:

```ts
const project = await projectRepo.create({...});
if (input.templateVersionId) {
  const files = await materializeTemplate(input.templateVersionId);
  for (const f of files) {
    await fileRepo.create({ projectId: project.id, path: f.path, kind: 'typst', textContent: f.content });
  }
  await projectSettingsRepo.upsert({ projectId: project.id, mainPath: 'main.typ', templateVersionId: input.templateVersionId });
}
```

`materializeTemplate` là interface trong `modules/projects/domain/Ports.ts`:

```ts
export interface MaterializeTemplate {
  (versionId: string): Promise<Array<{ path: string; content: string }>>;
}
```

Adapter ở `app.ts` (hoặc container root) nối:

```ts
const templatesContainer = createTemplatesContainer({ prisma });
const projectsContainer = createProjectsContainer({
  prisma,
  materializeTemplate: templatesContainer.materializeTemplateVersion,
});
```

Module `projects` không import bất kỳ thứ gì từ `modules/templates/infra/` — chỉ phụ thuộc lên type/interface khai báo trong domain của chính nó.

## 7. Plugin order & route registration

`backend/src/app.ts` thêm:

```ts
import { adminTemplatesRoutes, publicTemplatesRoutes } from "./modules/templates/delivery/http/Routes.js";

// ... sau khi register `projects`:
await app.register(adminTemplatesRoutes,  { prefix: "/api/v1" });
await app.register(publicTemplatesRoutes, { prefix: "/api/v1" });
```

Cần `@fastify/multipart` (kiểm tra `package.json`; nếu chưa có thì spec thêm dependency `^9.x`).

## 8. Migration & seed

### Migration

Prisma model `Template` / `TemplateVersion` đã có sẵn → KHÔNG cần migration mới cho schema. Cần thêm column nếu Phase 1 muốn lưu `entryPath` (đường dẫn main file trong storage) để hỗ trợ template không tên `main.typ`:

```prisma
model TemplateVersion {
  ...
  entryPath String @default("main.typ")
  ...
}
```

→ Tạo migration `add_template_version_entry_path`.

### Seed

`backend/prisma/seed/templates.ts` (mới):

- 3 template official: "Khóa luận tốt nghiệp K2024", "Báo cáo thực tập", "Đề cương nghiên cứu".
- Mỗi template 1 version `v1.0.0` active, file `main.typ` mẫu nằm trong `backend/prisma/seed/template-assets/<slug>/main.typ`.

Seed script đọc file mẫu, gọi trực tiếp `TemplateRepoPrisma.create*` + `TemplateStorageFs.writeArchive`. Idempotent: skip nếu template name đã tồn tại.

## 9. Test plan

| Loại | File | Phạm vi |
|---|---|---|
| Unit | `tests/unit/templates/CreateTemplate.spec.ts` | Use case + repo mock |
| Unit | `tests/unit/templates/CreateTemplateVersion.spec.ts` | Storage gateway mock + zip extraction |
| Unit | `tests/unit/templates/MaterializeTemplateVersion.spec.ts` | Đọc files từ storage gateway |
| API  | `tests/api/templates.admin.spec.ts` | E2E: login admin → CRUD + upload version |
| API  | `tests/api/templates.public.spec.ts` | E2E: login student → list + tạo project từ template |

`package.json` thêm scripts:

```json
"test:unit:templates": "vitest run tests/unit/templates",
"test:api:templates":  "vitest run tests/api/templates"
```

## 10. Tham chiếu

- Steering: `.kiro/steering/backend-system-structure.md` — kiến trúc module
- Steering: `.kiro/steering/security-best-practices.md` — sanitize file path, reject path traversal
- Steering: `.kiro/steering/typescript-best-practices.md` — DTO boundary
- Reference module: `backend/src/modules/admin/delivery/http/Faculty/` — pattern Routes.ts/Dto.ts
- Spec liên quan: `.kiro/specs/templates-frontend/` — UI consumer của các DTO ở đây
- Spec đang chạy: `.kiro/specs/admin-crud-integration/` — bulk import có thể tái dùng `ImportFileDialog` cho template version sau này
