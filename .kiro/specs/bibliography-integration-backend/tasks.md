# Tasks — Bibliography Integration (Backend)

Thứ tự task theo dependency (mỗi task hoàn tất trước khi task kế tiếp bắt đầu). Mỗi task có **acceptance** (kết quả phải đạt) và **verify** (cách kiểm chứng).

> Thiết kế database tham chiếu [`database-design.md`](./database-design.md). Task B-1 dưới đây là task chuẩn bị schema, chạy **trước** B0.

---

## Task B-1 — Prisma schema migration (FileKind expansion + Bibliography audit)

**File**: `backend/prisma/schema.prisma`

Áp dụng patch theo `database-design.md` §3 "Patch Prisma Schema" (gộp 2 mảng thay đổi vào **một migration duy nhất**):

**Phần A — FileKind**:
- Mở rộng enum `FileKind` thêm 6 value: `vector`, `font`, `markdown`, `config`, `text`, `pdf` (giữ nguyên 5 value cũ).

**Phần B — Bibliography**:
- Thêm enum `OpenAlexImportStatus` (3 giá trị: `imported`, `skipped_duplicate`, `failed`).
- Thêm model `OpenAlexImportLog` (3 index, 2 FK Cascade).
- Mở rộng `ZoteroSyncLog`: +5 cột (`targetBibPath`, `itemsAdded`, `itemsUpdated`, `itemsSkipped`, `errorCode`) + FK `project Project?` (onDelete SetNull) + đổi index thành composite `(projectId, startedAt)`.
- Thêm cột `openalexConfig Json?` vào `ProjectSettings`.
- Thêm reverse relation: `User.openAlexImportLogs`, `Project.zoteroSyncLogs`, `Project.openAlexImportLogs`.
- Bổ sung doc-block `///` cho `ZoteroConnection` và `OpenAlexImportLog`.

**Migration**: dev chạy thủ công (theo `CLAUDE.md` Claude KHÔNG tự `prisma migrate`):

```powershell
cd backend
npx prisma migrate dev --name expand_files_and_bibliography_audit
npx prisma generate
```

**Acceptance**:
- File migration mới xuất hiện trong `backend/prisma/migrations/<timestamp>_expand_files_and_bibliography_audit/migration.sql` khớp preview SQL ở §4 của database-design.md.
- `backend/src/generated/prisma/index.d.ts` chứa type `OpenAlexImportLog`, `OpenAlexImportStatus`; `ZoteroSyncLog` có field mới; type `FileKind` có 11 giá trị.
- `psql`: `\d "OpenAlexImportLog"` thấy 3 index + 2 FK; `\d "ZoteroSyncLog"` thấy FK đến `Project`; `SELECT unnest(enum_range(NULL::"FileKind"))` trả về 11 dòng.

**Verify**:
```powershell
cd backend
npm run build
```

---

## Task B-1a — Refactor project-files: centralize FileKind logic

**Files**:
- `backend/src/modules/project-files/domain/FileKindPolicy.ts` (MỚI)
- `backend/src/modules/project-files/domain/ProjectFile/Types.ts` (SỬA: TS mirror enum)
- `backend/src/modules/project-files/delivery/http/ProjectFile/Dto.ts` (SỬA: U2 — `z.nativeEnum(FileKind)` hoặc list đầy đủ 11 value)
- `backend/src/modules/project-files/delivery/http/ProjectFile/Routes.ts` (SỬA: U3 — dùng `isBinaryKind` + `getMimeTypeForKind`)
- `backend/src/modules/project-files/infra/FileRepoPrisma.ts` (SỬA: U4 — dùng `getCompilationKinds()`)
- `backend/src/modules/project-files/application/CreateFileUseCase.ts` (SỬA: U2 — `kind` Zod optional, fallback `detectKindFromPath(path)`)
- `backend/src/modules/projects/application/CreateProjectUseCase.ts` (SỬA: U5 — `detectKindFromPath` thay ternary)

Theo `database-design.md` §6.

**Acceptance**:
- `FileKindPolicy.ts` có 4 hàm pure: `detectKindFromPath`, `isBinaryKind`, `isCompilationInput` (+ alias `getCompilationKinds`), `getMimeTypeForKind`. Không phụ thuộc Prisma client/Fastify.
- 4 điểm hard-code cũ đã thay bằng helper call; grep `kind === 'image'`/`kind: { in: [` trong `backend/src/modules/project-files/` và `projects/` ra zero.
- Unit test cho `detectKindFromPath` 13 case (mỗi extension ≥1 + path không có extension trả `other`).
- Unit test cho `isBinaryKind`, `isCompilationInput` cover toàn bộ 11 kind.

**Verify**:
```powershell
cd backend
npm run build
npm run test:unit:project-files
```

Smoke manual:
- Upload `logo.svg` (không gửi `kind`) → DB row có `kind = 'vector'`.
- Upload `Lora.ttf` → DB row `kind = 'font'`, `storageKey` set, `textContent` NULL.
- `GET .../files/Lora.ttf` trả `Content-Type: font/ttf` + binary đúng.
- Compile project có cả `.typ + .toml + .ttf + .svg` → các file đó xuất hiện trong input của Typst compile (kiểm tra qua log).

---

## Task B0 — Helper crypto dùng chung

**File**: `backend/src/shared/crypto/SecretCipher.ts`

- Tạo class `SecretCipher` AES-256-GCM, key derive từ `jwtSecret` qua `hkdfSync("sha256", ..., "zotero-token-v1", 32)`.
- Public methods `encrypt(plain): string` (format `v1:iv:tag:cipher` base64) và `decrypt(blob): string`.

**Acceptance**: encrypt → decrypt round-trip ra đúng plain. Sai authTag throw error.
**Verify**: `npm run build`; viết test `shared/crypto/SecretCipher.test.ts` (5 case: happy, tampered ciphertext, tampered iv, wrong jwtSecret, missing v1 prefix).

---

## Task B1 — Bibliography domain primitives

**Files**:
- `backend/src/modules/bibliography/domain/BibEntry.ts`
- `backend/src/modules/bibliography/domain/CitationKeyGen.ts`
- `backend/src/modules/bibliography/domain/BibSerializer.ts`
- `backend/src/modules/bibliography/domain/BibParser.ts`

Triển khai theo design.md (mục Domain & Port). Không phụ thuộc Prisma/Fastify.

**Acceptance**:
- `serialize(parse(text)) ≈ text` (bỏ qua whitespace) cho 3 fixture đại diện (article, book, incollection).
- `generateCitationKey({authors:[{lastName:"Smith"}], year:"2024", title:"Machine learning"})` === `"Smith2024Machine"`.
- `dedupeKey("Smith2024", new Set(["Smith2024","Smith2024a"]))` === `"Smith2024b"`.

**Verify**: `npm run test:unit` (file test cùng folder, vitest/jest theo cấu hình hiện có); `npm run build`.

---

## Task B2 — BibliographyService (application)

**File**: `backend/src/modules/bibliography/application/BibliographyService.ts`

- Constructor nhận `FileRepo` (port từ `project-files`).
- Method `readBibFile(projectId, path): Promise<BibEntry[]>` — trả `[]` nếu file chưa tồn tại.
- Method `writeBibFile(projectId, path, entries): Promise<void>` — upsert (tạo mới nếu chưa có) với `kind = "bib"`.
- Method `mergeEntries(existing, incoming): BibEntry[]` — entries trùng key thì incoming ghi đè existing.

**Acceptance**: gọi `writeBibFile` lần đầu tạo File mới; lần 2 update content; readBibFile trả entries đã parse.
**Verify**: `npm run build`; unit test với mock FileRepo.

---

## Task B3 — Zotero domain layer

**Files**:
- `backend/src/modules/zotero/domain/Types.ts` (ZoteroItem, ZoteroCollection — shape API thô)
- `backend/src/modules/zotero/domain/Ports.ts` (3 interface ở design.md)
- `backend/src/modules/zotero/domain/Errors.ts` (4 class error)
- `backend/src/modules/zotero/domain/Mapping.ts` (`mapZoteroItemToBibEntry`)

**Acceptance**: mapping bảng trong design.md đúng cho 6 itemType. Authors `creators[]` → `"lastName, firstName and ..."`.
**Verify**: unit test mapping với 3 fixture JSON Zotero (lấy mẫu từ `references/texlyre/.../zotero` hoặc Zotero API docs); `npm run build`.

---

## Task B4 — ZoteroApiClient (infra)

**File**: `backend/src/modules/zotero/infra/ZoteroApiClient.ts`

- Implements `ZoteroApiPort` dùng global `fetch`.
- Headers `Zotero-API-Key`, `Zotero-API-Version: 3`.
- Base URL từ config (default `https://api.zotero.org`).
- Endpoint `/{user|group}/{libraryId}/collections` và `/items`.
- Pagination: trả `total` từ header `Total-Results`.
- Map 401 → `ZoteroAuthError`, 404 → `ZoteroLibraryNotFoundError`, 5xx → `ZoteroSyncError`.
- Retry 1 lần với backoff 500ms cho 429/5xx.

**Acceptance**: Gọi `verifyKey()` với key sai trả `ZoteroAuthError`. `listItems({ limit: 100 })` paginate đúng.
**Verify**: integration test thủ công với 1 key thật; unit test với `fetch` mock.

---

## Task B5 — Zotero Prisma repositories

**Files**:
- `backend/src/modules/zotero/infra/ZoteroConnectionRepoPrisma.ts`
- `backend/src/modules/zotero/infra/ZoteroSyncLogRepoPrisma.ts`

- `ZoteroConnectionRepoPrisma` inject `SecretCipher`. `upsert`: encrypt `apiKey` → lưu vào `accessToken`. `getByUserId`: decrypt trước khi trả.
- `ZoteroSyncLogRepoPrisma` implement đầy đủ method ở Port. `markRunning/Success/Failed` cập nhật status + thời gian + `errorMessage`.

**Acceptance**: token trong DB là chuỗi `v1:...`. Decrypt round-trip ra đúng key gốc.
**Verify**: `npm run build`; smoke test với SQLite/Postgres test DB hoặc mock Prisma.

---

## Task B6 — Zotero use cases (application)

**Files**: 7 file dưới `backend/src/modules/zotero/application/`:

- `ConnectZotero.ts`: gọi `apiClient.verifyKey` trước khi `connRepo.upsert`.
- `GetMyConnection.ts`: trả null nếu không có; chuyển sang ConnectionDto (KHÔNG include accessToken).
- `DisconnectZotero.ts`.
- `ListCollections.ts`, `ListItems.ts`: load conn, decrypt, gọi apiClient.
- `SyncToBibFile.ts`: theo flow đã trình bày trong design.md "SyncToBibFile use case (core logic)".
- `GetSyncLogs.ts`: gọi `projectAccess.requireAccess`.

**Acceptance**: `ConnectZotero` gọi `verifyKey` (nếu sai → 401). `SyncToBibFile` ghi `ZoteroSyncLog` cả pending → running → success/failed.
**Verify**: `npm run build`; unit test mỗi use case với mock port.

---

## Task B7 — Zotero delivery (Routes + Dto)

**Files**:
- `backend/src/modules/zotero/delivery/http/Dto.ts` — toàn bộ schema Zod ở design.md.
- `backend/src/modules/zotero/delivery/http/Routes.ts` — 7 route, mỗi route dùng `app.auth.verify`, parse body/query qua DTO, gọi use case từ container, map error → HTTP code.
- `backend/src/modules/zotero/Container.ts`.

**Acceptance**: response shape khớp `ZoteroConnectionDto/ZoteroCollectionDto/ZoteroItemDto/ZoteroSyncLogDto`. Error trả `{ error: { code, message } }`.
**Verify**: `npm run build`. Swagger sinh đúng (mở `/docs` nếu enable).

---

## Task B7.5 — OpenAlexImportLog repo (infra + port)

**Files**:
- `backend/src/modules/openalex/domain/Ports.ts`: thêm interface `OpenAlexImportLogRepo` với method `create`, `findByProjectAndOpenAlexId`, `listByProject(projectId, limit)`.
- `backend/src/modules/openalex/infra/OpenAlexImportLogRepoPrisma.ts`: implement bằng Prisma client.

**Acceptance**: `findByProjectAndOpenAlexId` trả `null` khi chưa import, hoặc record đầu tiên có `status === "imported"` (dùng cho dedupe).
**Verify**: `npm run build`; unit test với mock Prisma.

---

## Task B8 — OpenAlex toàn bộ module

**Files**:
- `backend/src/modules/openalex/domain/Types.ts` (OpenAlexWork raw shape)
- `backend/src/modules/openalex/domain/Ports.ts`
- `backend/src/modules/openalex/domain/Errors.ts`
- `backend/src/modules/openalex/domain/Mapping.ts` — `mapOpenAlexWorkToBibEntry` + `reconstructAbstract(invertedIndex)`.
- `backend/src/modules/openalex/infra/OpenAlexApiClient.ts` — fetch, polite mode `?mailto={mailto}`, filter builder `publication_year:{from}-{to}`, `is_oa:true`, `type:{type}`. Map 429 → RateLimitError, 404 → NotFoundError.
- `backend/src/modules/openalex/application/{SearchWorks,GetWorkById,ImportToBibFile}.ts`.
- `backend/src/modules/openalex/delivery/http/{Dto,Routes}.ts`.
- `backend/src/modules/openalex/Container.ts`.

**Acceptance**:
- `searchWorks({ search:"typst", perPage:5 })` trả `works` đúng shape `OpenAlexWorkDto`.
- Abstract reconstruct từ inverted_index đúng (test với fixture nhỏ).
- `ImportToBibFile`:
  - Trước khi map: gọi `OpenAlexImportLogRepo.findByProjectAndOpenAlexId` cho mỗi ID → nếu đã import → push vào `skippedDuplicate` (không gọi `.bib`).
  - Sau khi append `.bib` thành công: ghi `OpenAlexImportLog` status `imported`.
  - Trên lỗi mapping/fetch: ghi log status `failed` + đẩy vào `failed` của response.
- Response khớp shape `ImportResponse` (xem `design.md` mục DTO).

**Verify**: unit test mapping + abstract reconstruction; `npm run build`; smoke test thủ công với `search=typst`.

---

## Task B9 — Config + register vào app.ts

**Files**:
- `backend/src/config/index.ts`: thêm field `openalexMailto`, `zoteroApiBase`.
- `backend/.env.example`: 2 env mới.
- `backend/src/app.ts`: import + wire 2 router theo design.md "Register vào app.ts".
- Nếu `ProjectsContainer` chưa expose `getProjectAccessPolicy()` → thêm getter.

**Acceptance**: Build pass. `/api/v1/zotero/...` và `/api/v1/openalex/...` xuất hiện trong Swagger.
**Verify**:
```powershell
cd backend
npm run build
npm run start              # khởi động dev server
# curl -i http://localhost:3000/api/v1/zotero/connections/me -H "Authorization: Bearer <token>"
```

---

## Task B10 — Smoke test + integration report

**Files**:
- (optional) `backend/scripts/test-api-zotero.ps1` và `test-api-openalex.ps1` theo pattern các script `test:api:*` hiện có.
- `.kiro/reports/backend-frontend-integration/bibliography-integration-status.md`: thêm section "Backend complete" với:
  - Endpoints đã đăng ký
  - DTO shape (link tới Dto.ts)
  - Issues/limitations
  - Change history entry

**Acceptance**: Khi chạy script với key thật, các endpoint trả status 2xx đúng kỳ vọng. Report cập nhật.
**Verify**: Chạy script. Đọc report.

---

## Definition of done (backend)

- [x] Migration `expand_files_and_bibliography_audit` đã chạy: enum `FileKind` có 11 value; bảng `OpenAlexImportLog` tồn tại; `ZoteroSyncLog` có cột mới + FK `projectId`.
- [x] `FileKindPolicy.ts` tồn tại + 4 điểm hard-code (U2/U3/U4/U5) đã được thay bằng helper call.
- [x] Upload `.svg/.ttf/.md/.toml/.pdf` → DB row đúng kind (server detect khi client không gửi).
- [x] `findForCompilation` trả về cả font/vector/config khi compile.
- [x] `npm run build` pass không warning.
- [x] Tất cả unit test mới pass.
- [x] `app.ts` register 2 router mới sau `projectFilesContainer`.
- [x] Swagger hiển thị nhóm `zotero` + `openalex`.
- [x] `ZoteroConnection.accessToken` lưu dạng `v1:...` trong DB.
- [x] Manual: sync 1 collection Zotero thực → file `.bib` tạo trong project, có thể đọc lại qua `GET /api/v1/projects/:projectId/files/bibliography.bib`; row `ZoteroSyncLog` mới có `targetBibPath` + `itemsAdded/Updated/Skipped`.
- [x] Manual: search `typst` trên OpenAlex → import 1 work → entry xuất hiện trong `.bib`; row `OpenAlexImportLog` status `imported`. Import lại cùng ID → row mới status `skipped_duplicate`, `.bib` không đổi.
- [x] Xoá project → `ZoteroSyncLog.projectId` thành NULL; `OpenAlexImportLog` rows bị Cascade xoá.
- [x] Report `bibliography-integration-status.md` cập nhật.
