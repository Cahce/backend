# Requirements — Bibliography Integration (Backend)

## Mục tiêu

Cung cấp HTTP API cho phép frontend TLU Scholar Editor (1) kết nối tài khoản Zotero của sinh viên, (2) đồng bộ collections/items từ Zotero vào file `.bib` của project, (3) tìm tài liệu trên OpenAlex qua proxy backend, (4) import entry OpenAlex thành BibTeX vào project.

**Đồng thời** (gộp vào cùng migration để giảm churn DB) **mở rộng module `project-files`** hỗ trợ thêm các định dạng cần thiết cho Typst: `.svg` (vector), `.ttf/.otf/.woff/.woff2` (font), `.md` (markdown), `.toml/.yaml/.yml/.json` (config), `.txt` (text), `.pdf`. Centralize logic phân loại + binary streaming + compile filter qua một helper duy nhất `FileKindPolicy.ts`.

Tuân thủ Clean Architecture đã định nghĩa trong `.kiro/steering/backend-system-structure.md`.

## Phạm vi

- Module `zotero` (mở rộng skeleton hiện có): connection + collections + items + sync.
- Module `openalex` (mới): proxy search + work detail + import.
- Module dùng chung `bibliography`: BibEntry, BibSerializer, BibParser, CitationKeyGen, WriteBibFile/ReadBibFile (gọi tới ProjectFile repository).
- Mã hoá API key Zotero (AES-256-GCM, key derive từ `JWT_SECRET` qua HKDF) qua helper `shared/crypto/SecretCipher.ts`.
- **Mở rộng `FileKind`** (+6 value `vector/font/markdown/config/text/pdf`) + tạo `FileKindPolicy.ts` (detect/binary/compile/MIME) + refactor 4 điểm code U2/U3/U4/U5 trong `project-files` & `projects` module (xem `database-design.md` §1.3, §6).

Ngoài phạm vi: Zotero OAuth, Zotero attachment download, citation styles (CSL) processing, Crossref/Semantic Scholar, thay đổi cấu trúc bảng `File` (chỉ enum mở rộng).

## User stories

1. **Sinh viên kết nối Zotero**: Là sinh viên đã đăng nhập, tôi có thể POST `/api/v1/zotero/connections` với `{ apiKey, libraryId, libraryType }` để liên kết tài khoản Zotero của mình. API key được mã hoá trước khi lưu.
2. **Sinh viên xem connection**: GET `/api/v1/zotero/connections/me` trả về metadata connection (KHÔNG chứa apiKey).
3. **Sinh viên ngắt kết nối**: DELETE `/api/v1/zotero/connections/me` xoá bản ghi.
4. **Sinh viên xem collections**: GET `/api/v1/zotero/collections` trả về danh sách collection (tree) của library đã connect.
5. **Sinh viên xem items**: GET `/api/v1/zotero/items?collectionKey=&start=&limit=` trả về items có pagination.
6. **Sinh viên sync sang .bib**: POST `/api/v1/zotero/projects/:projectId/sync` với `{ collectionKeys?, itemKeys?, targetBibPath, syncType }` → backend fetch items, map sang BibEntry, ghi vào file `.bib` chỉ định (tạo mới nếu chưa có), ghi `ZoteroSyncLog`.
7. **Sinh viên xem lịch sử sync**: GET `/api/v1/zotero/projects/:projectId/sync-logs?limit=`.
8. **Sinh viên search OpenAlex**: GET `/api/v1/openalex/works?search=&yearFrom=&yearTo=&isOA=&type=&perPage=&page=` trả về list works + meta.
9. **Sinh viên xem chi tiết work**: GET `/api/v1/openalex/works/:openAlexId`.
10. **Sinh viên import OpenAlex vào .bib**: POST `/api/v1/openalex/projects/:projectId/import` với `{ openAlexIds, targetBibPath }` → backend fetch + map + append vào `.bib`. Backend dedupe theo `OpenAlexImportLog` (xem `database-design.md`): nếu đã import work đó vào project → trả `skippedDuplicate` thay vì append trùng.
11. **Backend audit log**: mọi sync Zotero ghi `ZoteroSyncLog` (kèm `targetBibPath`, `itemsAdded/Updated/Skipped`); mọi attempt import OpenAlex ghi 1 `OpenAlexImportLog` (status `imported`/`skipped_duplicate`/`failed`).
12. **Upload đa định dạng**: sinh viên upload `.svg`, `.ttf`, `.otf`, `.md`, `.toml`, `.yaml`, `.json`, `.txt`, `.pdf` qua `POST /api/v1/projects/:id/files`. Backend tự detect `kind` từ extension nếu client không gửi (qua `FileKindPolicy.detectKindFromPath`).
13. **Download binary đúng MIME**: `GET /api/v1/projects/:id/files/:path` trả binary stream + `Content-Type` đúng cho font/svg/pdf/image qua `isBinaryKind` + `getMimeTypeForKind`.
14. **Compile pipeline đúng**: `findForCompilation` đưa cả font/vector/config vào input Typst (Typst cần font cho `--font-path`, cần `typst.toml` cho package manifest).

## Acceptance criteria

- Tất cả route đăng ký dưới prefix `/api/v1`. Mọi route đều dùng `app.auth.verify`. Route có `:projectId` dùng `ProjectAccessPolicy` của module `projects` để chặn user ngoài project.
- DTO Zod validate request/response. DTO **không** chứa `accessToken`, `refreshToken`. Connection DTO chỉ chứa `hasApiKey: true` + metadata công khai.
- Lỗi trả shape `{ error: { code, message } }` với code:
  - `ZOTERO_NOT_CONNECTED` (404), `ZOTERO_AUTH_FAILED` (401), `ZOTERO_SYNC_FAILED` (502), `ZOTERO_LIBRARY_NOT_FOUND` (404)
  - `OPENALEX_NOT_FOUND` (404), `OPENALEX_RATE_LIMITED` (429), `OPENALEX_UPSTREAM_ERROR` (502)
  - `PROJECT_NOT_FOUND` / `PROJECT_FORBIDDEN` (reuse từ projects module)
  - `BIB_INVALID_TARGET_PATH` (400) khi `targetBibPath` không kết thúc `.bib`
- Citation key sinh theo pattern `{LastName}{Year}{FirstMeaningfulWord}`, dedupe bằng suffix `a/b/c` khi trùng với entry đã có trong `.bib`.
- File `.bib` tạo qua project-files API (FileKind `bib`). Khi sync, file được upsert (nếu đã tồn tại → merge entries theo key, key trùng → ghi đè).
- ZoteroSyncLog ghi đủ `connectionId`, `projectId`, `syncType`, `status`, `itemsSynced`, `startedAt`, `finishedAt` (+ `errorMessage` khi fail).
- Backend `npm run build` pass. Smoke test thủ công các endpoint trả status đúng.
- **Project-files**: enum `FileKind` 11 value; `FileKindPolicy.ts` cover 4 hàm; grep `kind === 'image'` & `kind: { in: [` trong `modules/project-files/` và `modules/projects/` ra zero (đã centralize).

## Non-functional

- **Bảo mật**: API key encrypt-at-rest (AES-256-GCM + HKDF từ JWT_SECRET). Không log apiKey, accessToken, body item content. Polite mode OpenAlex luôn append `mailto=<OPENALEX_MAILTO>`.
- **Performance**: ListItems hỗ trợ pagination (`start`, `limit` ≤ 100 — khớp giới hạn Zotero). OpenAlex search debounce phía client; backend không cache (giữ stateless).
- **Resilience**: ZoteroApiClient retry 1 lần với exponential backoff khi gặp 429/5xx; OpenAlexApiClient tương tự.
- **Boundary**: `bibliography` không depend `zotero`/`openalex`; ngược lại 2 module này depend `bibliography` qua port. `delivery/http` không import Prisma trực tiếp.

## Phụ thuộc & Ràng buộc

- Prisma models đã có: `ZoteroConnection`, `ZoteroSyncLog`, `ProjectSettings`, enum `ZoteroLibraryType / ZoteroSyncStatus / ZoteroSyncType`. **Cần migration mới** `add_bibliography_audit` (xem `database-design.md`): mở rộng `ZoteroSyncLog` (+5 cột, +1 FK), thêm model `OpenAlexImportLog` + enum `OpenAlexImportStatus`, thêm cột `openalexConfig` vào `ProjectSettings`.
- Reuse `FileRepoPrisma` của `project-files` để đọc/ghi file `.bib`. Reuse `ProjectAccessPolicy` (hoặc tương đương) của `projects` để kiểm tra quyền.
- Env mới: `OPENALEX_MAILTO`, `ZOTERO_API_BASE` (optional, default `https://api.zotero.org`).
- KHÔNG thêm npm dep mới — dùng `fetch` global + `node:crypto` built-in.

## Tham chiếu

- Architecture/algorithm: `Frontendtluscholareditor/references/texlyre/extras/bibliography/{zotero,openalex}/` (chỉ học cách map, không copy code).
- Steering chính: `backend-system-structure.md`, `authentication-flow.md`, `security-best-practices.md`, `typescript-best-practices.md`, `testing-best-practices.md`.
- Plan: `C:\Users\hoang\.claude\plans\h-y-l-n-k-ho-ch-swirling-shell.md` (mục SPEC 1).
