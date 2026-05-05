# Editor Backend — Tasks

Ordered by dependency. Each task lists the files it touches, the acceptance condition, and a verification command. Do NOT skip ahead — later tasks assume earlier ones are merged.

## Phase 0 — Groundwork

### T0.1 Add storage env vars

**Files**:
- `backend/.env.example` (modify) — add `BLOB_STORAGE_DRIVER`, `STORAGE_DIR`, `COMPILE_WORKER_ENABLED`, `COMPILE_TIMEOUT_MS`, `TYPST_BIN`.
- `backend/src/config/index.ts` (modify) — extend the Zod env schema.

**Acceptance**: `cd backend && npm run build` passes; missing vars use the defaults documented in `design.md`.

**Verify**: `cd backend && node -e "import('./dist/config/index.js').then(m => console.log(m.config))"`.

---

## Phase 1 — Storage abstraction (no behavioral change yet)

### T1.1 Create `BlobStorage` port + `LocalBlobStorage`

**Files**:
- `backend/src/shared/storage/BlobStorage.ts` (new)
- `backend/src/shared/storage/LocalBlobStorage.ts` (new)
- `backend/src/shared/storage/Errors.ts` (new) — `STORAGE_NOT_FOUND`
- `backend/src/shared/storage/__tests__/LocalBlobStorage.test.ts` (new)

**Acceptance**: Round-trip a 5KB buffer; sha256 stable across runs; `head` returns same metadata as `put`.

**Verify**: `cd backend && npm run test:unit -- shared/storage`.

### T1.2 Add `S3BlobStorage` placeholder

**Files**:
- `backend/src/shared/storage/S3BlobStorage.ts` (new) — every method throws `STORAGE_NOT_IMPLEMENTED`.

**Acceptance**: TypeScript compiles. Selected only when `BLOB_STORAGE_DRIVER=s3`.

### T1.3 Storage plugin

**Files**:
- `backend/src/shared/storage/BlobStorageFactory.ts` (new)
- `backend/src/plugins/Storage.ts` (new)
- `backend/src/app.ts` (modify) — register `Storage` plugin between `Prisma` and `JWT`.

**Acceptance**: Server boots; `app.storage` is decorated; logs the active driver.

**Verify**: `cd backend && npm run dev` and confirm log line `storage driver: local`.

---

## Phase 2 — ProjectSettings module

### T2.1 Domain + repository

**Files**:
- `backend/src/modules/projects/domain/ProjectSettings.ts` (new)
- `backend/src/modules/projects/domain/ProjectSettingsRepository.ts` (new)
- `backend/src/modules/projects/infra/PrismaProjectSettingsRepository.ts` (new)

**Acceptance**: `ProjectSettings.fromPrisma()` round-trips a row; `repository.findOrCreate(projectId)` lazily inserts a default row with `mainPath = "main.typ"`.

**Verify**: `cd backend && npm run test:unit:projects`.

### T2.2 Use cases

**Files**:
- `backend/src/modules/projects/application/GetProjectSettings.ts` (new)
- `backend/src/modules/projects/application/UpdateProjectSettings.ts` (new) — validates `mainPath` exists in `File` table; uses `ProjectFileRepository.exists`.

**Acceptance**: `UpdateProjectSettings` rejects `mainPath = "../escape.typ"` with `INVALID_MAIN_PATH`; rejects a path that does not exist in files; accepts a valid path.

**Verify**: unit tests in `application/__tests__/UpdateProjectSettings.test.ts`.

### T2.3 HTTP delivery

**Files**:
- `backend/src/modules/projects/delivery/http/ProjectSettings/Dto.ts` (new)
- `backend/src/modules/projects/delivery/http/ProjectSettings/Routes.ts` (new)
- `backend/src/app.ts` (modify) — register `projectSettingsRoutes` under `/api/v1`.

**Acceptance**: `GET /api/v1/projects/{id}/settings` returns `{ settings }` (auto-creates row); `PUT` enforces validation.

**Verify**: `cd backend && npm run test:api:projects` (extend with `:settings` cases) or curl smoke test against a running backend.

---

## Phase 3 — project-files refinements

### T3.1 Conflict detection

**Files**:
- `backend/src/modules/project-files/delivery/http/ProjectFile/Routes.ts` (modify) — `POST` returns `409 FILE_PATH_CONFLICT` if path exists; `PATCH :rename` returns `409 RENAME_TARGET_EXISTS`.
- `backend/src/modules/project-files/delivery/http/ProjectFile/Dto.ts` (modify) — add error codes to documented schema.

**Acceptance**: New `test:api:project-files` cases for both conflicts pass.

**Verify**: `cd backend && npm run test:api:project-files`.

### T3.2 Update `lastEditedAt` on file write

**Files**:
- `backend/src/modules/project-files/infra/PrismaProjectFileRepository.ts` (modify) — within `create`/`update`, do `prisma.$transaction` to bump `file.lastEditedAt` and `project.lastEditedAt`.

**Acceptance**: After `PUT /files/main.typ`, `GET /projects/:id` reflects an updated `lastEditedAt`.

**Verify**: focused unit `npm run test:unit:project-files`.

### T3.3 Binary streaming

**Files**:
- `backend/src/modules/project-files/delivery/http/ProjectFile/Routes.ts` (modify) — when `kind in ("image","data")` and `storageKey` is set, stream `app.storage.get(storageKey)` with proper `Content-Type` and `Content-Length`.

**Acceptance**: `GET .../files/cover.png` returns binary bytes with `Content-Type: image/png`, not a JSON envelope.

**Verify**: `curl -OJ http://localhost:3000/api/v1/projects/{id}/files/cover.png` produces a real PNG (file size matches metadata).

---

## Phase 4 — compile module

### T4.1 Domain

**Files**:
- `backend/src/modules/compile/domain/CompileJob.ts` (new)
- `backend/src/modules/compile/domain/CompileDiagnostic.ts` (new)
- `backend/src/modules/compile/domain/Errors.ts` (new)
- `backend/src/modules/compile/domain/Policies.ts` (new) — depends on existing `projects` access policy
- `backend/src/modules/compile/domain/CompileJobRepository.ts` (new) — port
- `backend/src/modules/compile/domain/CompileArtifactRepository.ts` (new) — port
- `backend/src/modules/compile/domain/ProjectFileSnapshotPort.ts` (new) — port (read-only)
- `backend/src/modules/compile/domain/TypstCompileService.ts` (new) — port
- `backend/src/modules/compile/domain/CompileQueue.ts` (new) — port

**Acceptance**: `CompileJob` state machine unit tests cover all valid and invalid transitions.

**Verify**: `npm run test:unit:compile`.

### T4.2 Infrastructure

**Files**:
- `backend/src/modules/compile/infra/PrismaCompileJobRepository.ts` (new) — Zod-validates `diagnostics` JSON on read.
- `backend/src/modules/compile/infra/PrismaCompileArtifactRepository.ts` (new)
- `backend/src/modules/compile/infra/PrismaProjectFileSnapshotAdapter.ts` (new) — reuses `prisma.file.findMany` filtered by `projectId`.
- `backend/src/modules/compile/infra/NodeTypstCompileService.ts` (new) — `child_process.spawn(TYPST_BIN, ["compile", "--diagnostic-format=short", entry, output])` with timeout.
- `backend/src/modules/compile/infra/TypstStderrParser.ts` (new) — pure function `parse(stderr, workDir): CompileDiagnostic[]`. Splits lines, matches the short-format regex, accumulates trailing `help:` notes into `hints[]`, normalises `file` to project-relative.
- `backend/src/modules/compile/infra/InProcessCompileQueue.ts` (new) — single-worker FIFO; respects `COMPILE_WORKER_ENABLED`.

**Tests** (`infra/__tests__/`):
- `TypstStderrParser.test.ts` covers: single error with location; error with one and multiple hints; warning; two errors in different files; an error without a location; ANSI colors stripped.
- `NodeTypstCompileService.test.ts` integration: skip if `typst` not on PATH; otherwise invoke a known-bad fixture and assert `diagnostics[0].range.start.line` matches.
- `PrismaCompileJobRepository.test.ts` round-trips diagnostics (write -> read) with shape preserved.

**Acceptance**: With `COMPILE_WORKER_ENABLED=true`, the queue processes jobs sequentially; on shutdown it stops cleanly. Parser tests pass without a real `typst` binary; integration test passes when `typst` is installed locally.

**Verify**: `npm run test:unit:compile`.

### T4.3 Application use cases

**Files**:
- `backend/src/modules/compile/application/EnqueueCompileJob.ts` (new) — dedup logic
- `backend/src/modules/compile/application/ListCompileJobs.ts` (new)
- `backend/src/modules/compile/application/GetCompileJob.ts` (new)
- `backend/src/modules/compile/application/GetLatestArtifact.ts` (new)
- `backend/src/modules/compile/application/ProcessCompileJob.ts` (new)

**Acceptance**: 
- `EnqueueCompileJob` returns the existing active job when called twice within the dedup window.
- `ProcessCompileJob` happy path returns `success` with artifact; failure path returns `failed` with diagnostics; timeout path returns `failed` with `COMPILE_TIMEOUT`.

**Verify**: `npm run test:unit:compile`.

### T4.4 HTTP delivery + container

**Files**:
- `backend/src/modules/compile/Container.ts` (new)
- `backend/src/modules/compile/delivery/http/Dto.ts` (new)
- `backend/src/modules/compile/delivery/http/Routes.ts` (new)
- `backend/src/app.ts` (modify) — register `compileRoutes` under `/api/v1` after `project-files`.

**Acceptance**: 
- `POST /api/v1/projects/{id}/compile` returns `202` with `job.status = "queued"`.
- `GET /api/v1/projects/{id}/compile/{jobId}` returns the job object.
- `GET /api/v1/projects/{id}/compile/{jobId}/artifact` returns binary PDF when ready, `404 COMPILE_ARTIFACT_NOT_READY` otherwise.

**Verify**: new `npm run test:api:compile` script smoke-tests the four routes against a running backend with a seeded test project.

### T4.5 Update Swagger + route table

**Files**:
- `backend/src/swagger/index.ts` (modify) — add `compile` and `project-settings` tags.
- `.kiro/steering/backend-system-structure.md` (modify) — extend the registered-routes table.

**Acceptance**: Visiting `/docs` lists both new tags. Steering reflects current reality.

**Verify**: open `http://localhost:3000/docs` in a browser.

---

## Phase 5 — Verification end-to-end

### T5.1 Manual smoke

1. Start backend: `cd backend && npm run dev`.
2. Login as a student and create a project.
3. `PUT /api/v1/projects/{id}/files/main.typ` with body `= Hello\n\nWorld.`.
4. `POST /api/v1/projects/{id}/compile` — expect `202` with `status = "queued"`.
5. Poll `GET /compile/{jobId}` until `status = "success"` (should be < 5 seconds).
6. `GET /compile/{jobId}/artifact` — save the response and open the PDF.

**Acceptance**: All six steps succeed; PDF opens cleanly and contains "Hello, World."

### T5.2 Update integration report

**Files**:
- `.kiro/reports/backend-frontend-integration/editor-backend-integration-status.md` (new) — Summary, Backend Contract, Test Results, Issues Found, Next Actions, Change History.

**Acceptance**: Report uses the format documented in `.kiro/agents/fullstack-integration-agent.json`. Status `Passed` if all of T5.1 succeed.

---

## Quick reference

```powershell
# Build
cd backend
npm run build

# Focused tests
npm run test:unit:projects
npm run test:unit:project-files
npm run test:unit:compile        # new

# API smoke (requires running server + DB)
npm run test:api:projects
npm run test:api:project-files
npm run test:api:compile         # new
```

## Out of this spec

- Frontend wiring lives in `.kiro/specs/editor-frontend/`.
- Real-time collaboration via `ProjectSnapshot` is intentionally not started.
- Zotero routes registration is a separate spec.
