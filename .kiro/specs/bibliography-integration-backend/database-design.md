# Database Design — Bibliography + Project-Files Expansion (Backend)

> Plan thống nhất, đọc kèm `design.md`. Gom 2 nhóm thay đổi schema vào **một migration duy nhất** (`expand_files_and_bibliography_audit`):
> - **A. Project-files**: mở rộng `FileKind` để hỗ trợ `.svg`, `.ttf`, `.otf`, `.md`, `.toml`, `.yaml/.yml`, `.json`, `.pdf`, `.txt`, đồng thời centralize logic phân loại file.
> - **B. Bibliography**: hoàn thiện audit cho Zotero + OpenAlex.
>
> **Không chạy `prisma migrate` tự động** (theo `CLAUDE.md`). Plan này document SQL/Schema để dev chạy `npx prisma migrate dev` thủ công.

## 1. Hiện trạng

### 1.1 Schema Zotero đã có (migration `20260415082042_add_templates_and_zotero`)

`ZoteroLibraryType / ZoteroSyncStatus / ZoteroSyncType` đầy đủ. `ZoteroConnection`, `ZoteroSyncLog` đã có nhưng chưa đủ field audit. Xem `backend/prisma/schema.prisma:269-302` để chi tiết.

### 1.2 Schema project-files hiện tại (`schema.prisma:48-54, 420-438`)

```prisma
enum FileKind {
  typst
  bib
  image
  data
  other
}

model File {
  id           String    @id @default(cuid())
  projectId    String
  project      Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  path         String
  kind         FileKind  @default(other)
  textContent  String?   @map("content") @db.Text
  storageKey   String?
  mimeType     String?
  sizeBytes    Int?
  sha256       String?
  lastEditedAt DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@unique([projectId, path])
  @@index([projectId])
}
```

### 1.3 Audit: FileKind đang được dùng ở đâu

Từ audit codebase, **6 điểm critical** depend trực tiếp vào tên kind:

| # | File:line | Vai trò | Rủi ro khi mở rộng |
|---|---|---|---|
| U1 | `backend/src/modules/project-files/domain/ProjectFile/Types.ts:10-16` | TS mirror của enum Prisma | Phải sync khi thêm value |
| U2 | `backend/src/modules/project-files/delivery/http/ProjectFile/Dto.ts:15` | `z.enum(['typst','bib','image','data','other'])` Zod | Zod KHÔNG tự update theo Prisma → client gửi kind mới = 400 |
| U3 | `backend/src/modules/project-files/delivery/http/ProjectFile/Routes.ts:266` | `if ((file.kind === 'image' \|\| file.kind === 'data') && file.storageKey)` quyết định stream binary | **HIGH** — file `.pdf/.ttf/.svg` mới sẽ bị serve dạng JSON, corrupt download |
| U4 | `backend/src/modules/project-files/infra/FileRepoPrisma.ts:229` | `findForCompilation()` hard-code `kind: { in: ['typst','bib','image','data'] }` | **HIGH** — `.svg/.font/.toml` mới sẽ KHÔNG được đưa vào compile, font không nhúng vào PDF |
| U5 | `backend/src/modules/projects/application/CreateProjectUseCase.ts:93` | Ternary `? Typst : Other` khi materialize template | Medium — default `Other` cho kind không nhận diện, mất phân loại đẹp |
| U6 | `backend/src/modules/bibliography/application/BibliographyService.ts:82` | Hard-code `FileKind.Bib` khi ghi `.bib` | Low — chỉ ghi 1 kind cố định |

**Frontend** (`Frontendtluscholareditor/src/app/editor/...`):

- `types/editor.ts:21`: type union literal cần sync.
- `components/FileTreePanel.tsx:45-51`: `FILE_ICONS[kind]` Record exhaustive → thêm value buộc thêm icon (TS bắt lỗi sớm, tốt).
- `components/FileTreePanel.tsx:56-62`: hàm `kindFromPath` client-side cần mở rộng.

**Tóm tắt rủi ro**: thêm enum value mà KHÔNG refactor sẽ làm hỏng download (U3) + compile (U4). Bắt buộc tạo helper centralize.

### 1.4 Khoảng trống tổng hợp

| # | Vấn đề | Mức độ |
|---|---|---|
| **Files** | | |
| F1 | `FileKind` quá hẹp: không có font/svg/markdown/config/pdf/text | Cao |
| F2 | Backend không có hàm `detectKindFromPath` (frontend tự đoán → 2 nguồn) | Trung |
| F3 | Logic "binary vs text" rải rác (Routes.ts hard-code 2 kind) | Cao |
| F4 | Logic "compile input" hard-code list trong repo | Cao |
| **Bibliography** | | |
| B1 | `ZoteroConnection.accessToken` plaintext, không doc encryption | Trung |
| B2 | `ZoteroSyncLog.projectId` không có FK → mồ côi khi xoá project | Cao |
| B3 | `ZoteroSyncLog` thiếu `targetBibPath`, `itemsAdded/Updated/Skipped`, `errorCode` | Cao |
| B4 | `ProjectSettings.zoteroConfig` Json không có shape | Trung |
| B5 | **Chưa có model OpenAlex** (cần audit log import) | Cao |
| B6 | `refreshToken` thừa cho API-key flow | Thấp (giữ deprecated) |

## 2. Quyết định thiết kế

### 2.1 Mở rộng `FileKind` enum (F1)

**Chọn**: giữ 5 value cũ + thêm 6 value mới (để tránh re-tag dữ liệu cũ):

```prisma
enum FileKind {
  typst       // .typ
  bib         // .bib (BibTeX) + Hayagriva .yml/.yaml khi user override
  image       // raster: .png, .jpg, .jpeg, .gif, .webp
  vector      // MỚI — .svg
  font        // MỚI — .ttf, .otf, .woff, .woff2
  markdown    // MỚI — .md
  config      // MỚI — .toml, .yaml, .yml (mặc định), .json
  data        // .csv, .tsv, .xml
  text        // MỚI — .txt
  pdf         // MỚI — .pdf (artifact/reference)
  other
}
```

Lý do giữ tên cũ:
- `image` chỉ raster cho rõ; vector tách riêng để frontend chọn viewer khác.
- `font` riêng để compile pipeline biết bổ sung `--font-path` cho Typst.
- `config` gom .toml/.yaml/.json — đủ cho `typst.toml` package manifest.
- `text` ≠ `data`: `.txt` thường là README/note; `.csv/.tsv/.xml` là dữ liệu Typst đọc qua `read()`.
- `pdf` riêng để hiển thị viewer + ngăn re-compile thành PDF nhúng.

### 2.2 Helper centralize logic FileKind (F2, F3, F4)

**Chọn**: tạo module domain mới chứa 4 hàm thuần:

```ts
// backend/src/modules/project-files/domain/FileKindPolicy.ts (MỚI)

import type { FileKind } from "@prisma/client";

const EXT_MAP: Record<string, FileKind> = {
  typ: "typst",
  bib: "bib",
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image",
  svg: "vector",
  ttf: "font", otf: "font", woff: "font", woff2: "font",
  md: "markdown",
  toml: "config", yaml: "config", yml: "config", json: "config",
  csv: "data", tsv: "data", xml: "data",
  txt: "text",
  pdf: "pdf",
};

export function detectKindFromPath(path: string): FileKind {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  return EXT_MAP[ext] ?? "other";
}

/**
 * Kind có nội dung BINARY → upload qua storage (storageKey), không lưu textContent.
 * Frontend dùng để chọn input upload (FileReader vs ArrayBuffer).
 */
export function isBinaryKind(kind: FileKind): boolean {
  return kind === "image" || kind === "font" || kind === "pdf";
}

/**
 * Kind được đưa vào Typst compile pipeline (input cho `findForCompilation`).
 * Markdown/text/pdf KHÔNG vì Typst không đọc trực tiếp.
 */
export function isCompilationInput(kind: FileKind): boolean {
  return (
    kind === "typst" ||
    kind === "bib" ||
    kind === "image" ||
    kind === "vector" ||
    kind === "font" ||
    kind === "data" ||
    kind === "config"
  );
}

/**
 * MIME mặc định nếu DB không lưu `mimeType`. Dùng khi stream binary.
 */
export function getMimeTypeForKind(kind: FileKind, ext?: string): string {
  switch (kind) {
    case "image":
      return ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";
    case "vector": return "image/svg+xml";
    case "font":
      return ext === "otf" ? "font/otf" : ext === "woff" ? "font/woff" : ext === "woff2" ? "font/woff2" : "font/ttf";
    case "pdf": return "application/pdf";
    case "markdown": return "text/markdown; charset=utf-8";
    case "config": return ext === "json" ? "application/json" : ext === "toml" ? "application/toml" : "application/yaml";
    case "data": return ext === "csv" ? "text/csv" : ext === "tsv" ? "text/tab-separated-values" : "application/xml";
    case "typst": return "text/x-typst; charset=utf-8";
    case "bib": return "application/x-bibtex; charset=utf-8";
    case "text": return "text/plain; charset=utf-8";
    default: return "application/octet-stream";
  }
}
```

**Refactor 4 điểm code hiện tại** (xem §7.1 tasks):
- U2 (Dto.ts): `z.enum(Object.values(FileKind))` hoặc generate từ Prisma type.
- U3 (Routes.ts:266): `if (isBinaryKind(file.kind) && file.storageKey) { ... }`.
- U4 (FileRepoPrisma.ts:229): truyền danh sách từ `FileKindPolicy.getCompilationKinds()` (export helper trả `FileKind[]`).
- U5 (CreateProjectUseCase.ts): dùng `detectKindFromPath(filePath)` thay ternary.

### 2.3 Mã hoá `ZoteroConnection.accessToken` (B1)

**Chọn**: app-layer encrypt (AES-256-GCM + HKDF), format `v1:iv:tag:cipher`. Schema chỉ thêm doc-block `///`.

### 2.4 Hoàn thiện `ZoteroSyncLog` (B2, B3)

**Chọn**: +5 cột (`targetBibPath`, `itemsAdded`, `itemsUpdated`, `itemsSkipped`, `errorCode`) + FK `project Project?` (`onDelete: SetNull` để giữ audit) + đổi index thành composite `(projectId, startedAt)`.

### 2.5 Shape `zoteroConfig` + `openalexConfig` (B4)

**Chọn**: giữ Json nhưng khoá shape bằng Zod ở application layer. Thêm cột `openalexConfig Json?` đối xứng.

```ts
// backend/src/modules/projects/domain/ProjectSettingsConfig.ts (MỚI)
export const ZoteroConfigSchema = z.object({
  defaultTargetBibPath: z.string().regex(/\.bib$/).default("bibliography.bib"),
  autoSyncOnOpen: z.boolean().default(false),
  lastSelectedCollections: z.array(z.string()).max(50).default([]),
  citationStyle: z.string().default("default"),
});

export const OpenAlexConfigSchema = z.object({
  defaultTargetBibPath: z.string().regex(/\.bib$/).default("bibliography.bib"),
  rememberLastFilters: z.boolean().default(true),
  lastFilters: z.object({
    yearFrom: z.number().int().optional(),
    yearTo:   z.number().int().optional(),
    isOA:     z.boolean().optional(),
    type:     z.string().optional(),
  }).default({}),
});
```

### 2.6 OpenAlex Import Log (B5)

**Chọn**: Phương án B "Import Log" (loại stateless + loại cache full work). Schema:

```prisma
enum OpenAlexImportStatus {
  imported
  skipped_duplicate
  failed
}

model OpenAlexImportLog {
  id            String                @id @default(cuid())
  userId        String
  user          User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  projectId     String
  project       Project               @relation(fields: [projectId], references: [id], onDelete: Cascade)
  openAlexId    String
  citationKey   String
  targetBibPath String
  doi           String?
  title         String?
  year          Int?
  status        OpenAlexImportStatus
  errorMessage  String?
  importedAt    DateTime              @default(now())

  @@index([projectId, importedAt])
  @@index([userId, importedAt])
  @@index([openAlexId])
}
```

### 2.7 Không xử lý ở plan này

- `refreshToken` thừa (giữ cột, không đọc/ghi).
- Multi-library/user (giữ unique `userId, provider`).
- `File` không cần đổi cấu trúc — chỉ enum mở rộng.

## 3. Patch Prisma Schema (final, kết hợp)

```prisma
// =============== ENUMS ===============

enum FileKind {
  typst
  bib
  image
  vector       // MỚI
  font         // MỚI
  markdown     // MỚI
  config       // MỚI
  data
  text         // MỚI
  pdf          // MỚI
  other
}

enum OpenAlexImportStatus {   // MỚI
  imported
  skipped_duplicate
  failed
}

// =============== USER ===============

model User {
  // ... existing
  zoteroConnections   ZoteroConnection[]
  openAlexImportLogs  OpenAlexImportLog[]      // MỚI reverse
}

// =============== PROJECT ===============

model Project {
  // ... existing
  zoteroSyncLogs      ZoteroSyncLog[]          // MỚI reverse
  openAlexImportLogs  OpenAlexImportLog[]      // MỚI reverse
}

// =============== ZOTERO ===============

/// Kết nối Zotero của user.
/// `accessToken` lưu encrypted blob `v1:iv:tag:cipher` (base64),
/// mã hoá AES-256-GCM bởi `shared/crypto/SecretCipher.ts` (key HKDF từ JWT_SECRET).
/// `refreshToken` không dùng (chỉ API-key flow); giữ cột vì tương thích migration cũ.
model ZoteroConnection {
  id              String              @id @default(cuid())
  userId          String
  user            User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider        String              @default("zotero")
  accessToken     String              /// encrypted (xem doc-block model)
  refreshToken    String?             /// deprecated
  libraryId       String
  libraryType     ZoteroLibraryType
  connectedAt     DateTime            @default(now())
  lastSyncedAt    DateTime?
  updatedAt       DateTime            @updatedAt
  syncLogs        ZoteroSyncLog[]

  @@unique([userId, provider])
  @@index([userId])
}

model ZoteroSyncLog {
  id            String            @id @default(cuid())
  connectionId  String
  connection    ZoteroConnection  @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  projectId     String?
  project       Project?          @relation(fields: [projectId], references: [id], onDelete: SetNull)  // MỚI
  targetBibPath String?                                                                                  // MỚI
  syncType      ZoteroSyncType
  status        ZoteroSyncStatus
  itemsSynced   Int               @default(0)
  itemsAdded    Int               @default(0)                                                            // MỚI
  itemsUpdated  Int               @default(0)                                                            // MỚI
  itemsSkipped  Int               @default(0)                                                            // MỚI
  errorCode     String?                                                                                  // MỚI
  errorMessage  String?
  startedAt     DateTime          @default(now())
  finishedAt    DateTime?

  @@index([connectionId, startedAt])
  @@index([projectId, startedAt])                                                                        // SỬA composite
  @@index([status])
}

// =============== OPENALEX ===============

/// Audit từng entry OpenAlex được import vào file .bib của project.
/// Dùng cho dedupe (frontend disable nút "Lưu vào .bib" nếu đã import).
model OpenAlexImportLog {
  id            String                @id @default(cuid())
  userId        String
  user          User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  projectId     String
  project       Project               @relation(fields: [projectId], references: [id], onDelete: Cascade)
  openAlexId    String
  citationKey   String
  targetBibPath String
  doi           String?
  title         String?
  year          Int?
  status        OpenAlexImportStatus
  errorMessage  String?
  importedAt    DateTime              @default(now())

  @@index([projectId, importedAt])
  @@index([userId, importedAt])
  @@index([openAlexId])
}

// =============== PROJECT SETTINGS ===============

model ProjectSettings {
  projectId       String   @id
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  mainPath        String   @default("main.typ")
  compileOptions  Json?
  zoteroConfig    Json?
  openalexConfig  Json?                                                                                  // MỚI
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

`File` model không đổi — chỉ enum `FileKind` mở rộng. Cột `kind FileKind @default(other)` tự chấp nhận value mới.

## 4. Preview migration SQL

Dev chạy `npx prisma migrate dev --name expand_files_and_bibliography_audit`. Prisma sẽ sinh file tương đương:

```sql
-- ============================================================
-- A. FileKind enum expansion (6 value mới)
-- ============================================================
-- PostgreSQL: ALTER TYPE ADD VALUE phải chạy ngoài transaction;
-- Prisma migrate xử lý tự động bằng cách tách thành migration con.
ALTER TYPE "FileKind" ADD VALUE IF NOT EXISTS 'vector';
ALTER TYPE "FileKind" ADD VALUE IF NOT EXISTS 'font';
ALTER TYPE "FileKind" ADD VALUE IF NOT EXISTS 'markdown';
ALTER TYPE "FileKind" ADD VALUE IF NOT EXISTS 'config';
ALTER TYPE "FileKind" ADD VALUE IF NOT EXISTS 'text';
ALTER TYPE "FileKind" ADD VALUE IF NOT EXISTS 'pdf';

-- ============================================================
-- B. OpenAlexImportStatus enum (mới)
-- ============================================================
CREATE TYPE "OpenAlexImportStatus" AS ENUM ('imported', 'skipped_duplicate', 'failed');

-- ============================================================
-- C. ZoteroSyncLog: +5 cột, +1 FK, đổi index
-- ============================================================
ALTER TABLE "ZoteroSyncLog"
  ADD COLUMN "targetBibPath" TEXT,
  ADD COLUMN "itemsAdded"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "itemsUpdated"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "itemsSkipped"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "errorCode"     TEXT;

ALTER TABLE "ZoteroSyncLog"
  ADD CONSTRAINT "ZoteroSyncLog_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "ZoteroSyncLog_projectId_idx";
CREATE INDEX "ZoteroSyncLog_projectId_startedAt_idx"
  ON "ZoteroSyncLog"("projectId", "startedAt");

-- ============================================================
-- D. ProjectSettings: thêm openalexConfig
-- ============================================================
ALTER TABLE "ProjectSettings" ADD COLUMN "openalexConfig" JSONB;

-- ============================================================
-- E. OpenAlexImportLog: bảng mới
-- ============================================================
CREATE TABLE "OpenAlexImportLog" (
  "id"             TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "projectId"      TEXT NOT NULL,
  "openAlexId"     TEXT NOT NULL,
  "citationKey"    TEXT NOT NULL,
  "targetBibPath"  TEXT NOT NULL,
  "doi"            TEXT,
  "title"          TEXT,
  "year"           INTEGER,
  "status"         "OpenAlexImportStatus" NOT NULL,
  "errorMessage"   TEXT,
  "importedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OpenAlexImportLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OpenAlexImportLog_projectId_importedAt_idx"
  ON "OpenAlexImportLog"("projectId", "importedAt");
CREATE INDEX "OpenAlexImportLog_userId_importedAt_idx"
  ON "OpenAlexImportLog"("userId", "importedAt");
CREATE INDEX "OpenAlexImportLog_openAlexId_idx"
  ON "OpenAlexImportLog"("openAlexId");

ALTER TABLE "OpenAlexImportLog"
  ADD CONSTRAINT "OpenAlexImportLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpenAlexImportLog"
  ADD CONSTRAINT "OpenAlexImportLog_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
```

> Lưu ý PostgreSQL: nếu Prisma không tách tự động, có thể phải chia thành 2 migration step. Sau khi `prisma migrate dev` xong, kiểm tra `migration.sql` xem có cần edit không.

## 5. Backfill data

Trên dev DB sạch — không cần backfill. Trên staging/prod đã có data, chạy SQL sau **sau khi** migration apply để re-tag các file đang nằm sai kind:

```sql
-- File hiện gán kind='other' nhưng path đoán được kind mới
UPDATE "File" SET kind = 'vector'   WHERE kind = 'other' AND lower(path) LIKE '%.svg';
UPDATE "File" SET kind = 'font'     WHERE kind = 'other' AND lower(path) ~ '\.(ttf|otf|woff2?)$';
UPDATE "File" SET kind = 'markdown' WHERE kind = 'other' AND lower(path) LIKE '%.md';
UPDATE "File" SET kind = 'config'   WHERE kind = 'other' AND lower(path) ~ '\.(toml|yaml|yml|json)$';
UPDATE "File" SET kind = 'text'     WHERE kind = 'other' AND lower(path) LIKE '%.txt';
UPDATE "File" SET kind = 'pdf'      WHERE kind = 'other' AND lower(path) LIKE '%.pdf';

-- File đã gán 'image' nhưng thực ra là SVG → vector
UPDATE "File" SET kind = 'vector'   WHERE kind = 'image' AND lower(path) LIKE '%.svg';
```

Đóng gói thành migration data riêng nếu cần: `npx prisma migrate dev --create-only --name backfill_filekinds` rồi edit `migration.sql` thêm các UPDATE.

## 6. Refactor code project-files (BẮT BUỘC trước khi sử dụng kind mới)

### 6.1 Tạo `FileKindPolicy.ts`

Theo §2.2. Đặt tại `backend/src/modules/project-files/domain/FileKindPolicy.ts`. Pure function, không phụ thuộc Prisma client (chỉ import `FileKind` type).

### 6.2 Sửa `Dto.ts` (U2)

```ts
// trước
const FileKindEnum = z.enum(['typst', 'bib', 'image', 'data', 'other']);

// sau
const FileKindEnum = z.enum([
  'typst','bib','image','vector','font','markdown','config','data','text','pdf','other'
] as const);
```

Hoặc import từ `@prisma/client` rồi `z.nativeEnum(FileKind)` để tự đồng bộ.

### 6.3 Sửa `Routes.ts:266` (U3) — binary streaming

```ts
// trước
if ((file.kind === 'image' || file.kind === 'data') && file.storageKey) {
  // stream binary
}

// sau
import { isBinaryKind, getMimeTypeForKind } from "../../../domain/FileKindPolicy.js";
if (isBinaryKind(file.kind) && file.storageKey) {
  reply.header("Content-Type", file.mimeType ?? getMimeTypeForKind(file.kind, getExt(file.path)));
  // stream binary
}
```

### 6.4 Sửa `FileRepoPrisma.ts:229` (U4) — compile filter

```ts
// trước
where: { projectId, kind: { in: ['typst', 'bib', 'image', 'data'] } }

// sau
import { getCompilationKinds } from "../domain/FileKindPolicy.js";
where: { projectId, kind: { in: getCompilationKinds() } }
```

Trong `FileKindPolicy`:

```ts
export function getCompilationKinds(): FileKind[] {
  return (["typst","bib","image","vector","font","data","config"] as FileKind[]);
}
```

### 6.5 Sửa `CreateProjectUseCase.ts:93` (U5) — template materialize

```ts
// trước
kind: filePath.endsWith(".typ") ? FileKind.Typst : FileKind.Other

// sau
import { detectKindFromPath } from "../../project-files/domain/FileKindPolicy.js";
kind: detectKindFromPath(filePath)
```

### 6.6 Auto-detect kind khi client KHÔNG gửi

Trong `CreateFileUseCase.ts`: nếu request không có `kind`, gọi `detectKindFromPath(path)`. Hiện code force client gửi → nới lỏng làm optional ở Zod, server fallback detect.

### 6.7 Frontend đồng bộ (sync 3 file)

| File | Thay đổi |
|---|---|
| `src/app/editor/types/editor.ts:21` | Mở rộng union literal |
| `src/app/types/api.ts` (FileKind type nếu có) | Mở rộng |
| `src/app/editor/components/FileTreePanel.tsx:45-51` | Thêm icon Record (lucide: `Image`, `FileType` cho font, `FileText` cho md, `Settings` cho config, `FileBox` cho pdf, ...) |
| `src/app/editor/components/FileTreePanel.tsx:56-62` | Mở rộng `kindFromPath` theo cùng bảng EXT_MAP |

## 7. Tác động lên spec hiện có

### 7.1 `requirements.md` (backend) đã cập nhật

Phạm vi mở rộng: ngoài bibliography integration, thêm "mở rộng FileKind + refactor project-files để hỗ trợ font, vector, markdown, config, pdf".

### 7.2 `design.md` (backend) cần cập nhật

- Bổ sung subsection "Project-files refactor" tham chiếu §6 file này.
- DTO `ZoteroSyncLogDto` đã update (`targetBibPath`, `itemsAdded/Updated/Skipped`, `errorCode`).
- Response import OpenAlex đã update shape `imported/skippedDuplicate/failed`.

### 7.3 `tasks.md` (backend) — task mới chèn đầu

Thêm **2 task mới** trước Task B0:

| Task | Mô tả ngắn |
|---|---|
| **B-1** | Prisma migration `expand_files_and_bibliography_audit` (theo §3, §4) |
| **B-1a** | Refactor project-files: tạo `FileKindPolicy.ts` + sửa 4 điểm code U2/U3/U4/U5 (theo §6) |

Task B7.5 (`OpenAlexImportLogRepo`) giữ nguyên.

### 7.4 `tasks.md` (frontend) — task nhỏ mới

Thêm task **F-0a** trước F0:
- Mở rộng `FileKind` type + `kindFromPath` + `FILE_ICONS` cho 6 kind mới.

## 8. Verification end-to-end

```powershell
cd backend
npx prisma migrate dev --name expand_files_and_bibliography_audit
npx prisma generate
npm run build
```

Smoke test thủ công:

1. Upload file `logo.svg`, `Lora-Regular.ttf`, `README.md`, `typst.toml` qua `POST /api/v1/projects/:id/files` → 4 row trong `File` với `kind = vector/font/markdown/config` (server tự detect nếu client không gửi).
2. `GET /api/v1/projects/:id/files/Lora-Regular.ttf` trả `Content-Type: font/ttf` + binary stream (nhờ `isBinaryKind`).
3. `compileJob.findForCompilation(projectId)` trả về cả `.svg`, `.ttf`, `.toml` cùng các file `.typ/.bib` (nhờ `getCompilationKinds`).
4. POST `/api/v1/openalex/projects/:id/import` 2 IDs lần đầu → 2 row `OpenAlexImportLog` status=`imported`. POST lại cùng IDs → 2 row mới status=`skipped_duplicate`, `.bib` không đổi.
5. POST `/api/v1/zotero/projects/:id/sync` → row `ZoteroSyncLog` có `targetBibPath` + `itemsAdded/Updated/Skipped`.
6. DELETE project → `ZoteroSyncLog.projectId` = NULL (SetNull), `OpenAlexImportLog` rows bị Cascade xoá, `File` rows Cascade xoá.
7. `prisma studio`: `ZoteroConnection.accessToken` dạng `v1:...` (encrypted).

## 9. Phương án thay thế (đã loại)

- **FileKind theo `category` field tự do (text)**: mất type-safety, mất Prisma enum check.
- **Drop FileKind enum hoàn toàn, dùng MIME type**: refactor quá rộng, nhiều code switch theo kind ngày càng khó tracking.
- **2 migration tách rời (1 cho files, 1 cho bibliography)**: dev chạy 2 lần, không có lợi gì khi cả 2 đều nhỏ; gộp 1 lần đơn giản hơn.
- **Stateless OpenAlex** / **OAuth Zotero** / **Cache full OpenAlex works**: đã loại ở các vòng trước.

## 10. Tóm tắt thay đổi schema

| Đối tượng | Loại | Mô tả |
|---|---|---|
| `FileKind` enum | Mở rộng | +6 value: `vector`, `font`, `markdown`, `config`, `text`, `pdf` |
| `OpenAlexImportStatus` enum | Mới | 3 value |
| `OpenAlexImportLog` model | Mới | Audit + 3 index + 2 FK Cascade |
| `ZoteroSyncLog` | Sửa | +5 cột, +1 FK (project), đổi 1 index thành composite |
| `ProjectSettings.openalexConfig` | Cột mới | Json? |
| `ZoteroConnection` | Doc-block | Comment `///`, không đổi cột |
| `User`, `Project` | Reverse relation | +1-2 list relation mỗi model |

Một migration tổng `expand_files_and_bibliography_audit`. Không cần backfill phức tạp (dev DB sạch); staging có thể chạy 6 lệnh `UPDATE` ở §5.
