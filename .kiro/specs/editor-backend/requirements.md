# Editor Backend — Requirements

## Context

The hybrid Typst editor is partially backed by the backend today: `projects` and `project-files` modules are registered and complete; `compile` has Prisma schema (`CompileJob`, `CompileArtifact`) and a `GetFilesForCompilation` use case but no HTTP routes. There is no `ProjectSettings` HTTP surface, no artifact storage adapter, and no snapshot endpoint.

This spec captures the minimum backend surface the frontend editor needs to stop relying on mock data and to support server-side compile/export.

## Goals

- Register the `compile` module with HTTP routes so the frontend can request server-side PDF export and poll job status.
- Expose `ProjectSettings` (mainPath, compileOptions) over HTTP so the editor knows which file to compile and how.
- Introduce a small storage abstraction so artifacts/binary files can move between local filesystem (dev) and S3-compatible storage (prod) without changing use cases.
- Keep `project-files` ergonomic for editor usage (wildcard paths, content-type-aware responses).
- Remain inside the modular monolith + Clean Architecture boundaries already documented in `.kiro/steering/backend-system-structure.md`.

## Non-Goals (deferred to later specs)

- Real-time collaboration / CRDT (`ProjectSnapshot` stays schema-only).
- Zotero sync routes.
- Authoritative server-side incremental compile (server only does full export).
- Multi-tenant artifact retention policy / quotas.

## Functional Requirements

### R1. Register compile module

- **R1.1**: `compile` module routes are registered under `/api/v1/projects/:projectId/compile` in `backend/src/app.ts`. Order in plugin chain: after `project-files`.
- **R1.2**: All compile routes are protected by `app.auth.verify` and enforce project access through the same domain policy used by `projects`/`project-files`.
- **R1.3**: Failure modes return the standard `{ error: { code, message } }` envelope.

**Acceptance**:
- `GET http://localhost:3000/api/v1/projects/{id}/compile` (with valid bearer token) returns either an empty list or the user's previous jobs, not 404.
- A non-owner gets `403 PROJECT_ACCESS_DENIED`, not 200.

### R2. Compile job lifecycle endpoints

- **R2.1** — `POST /api/v1/projects/:projectId/compile`: enqueue an export job.
  - Body: `{ entryPath?: string, format?: "pdf", engine?: "node" }`. Defaults: `entryPath = ProjectSettings.mainPath ?? "main.typ"`, `format = "pdf"`, `engine = "node"`.
  - Response 202: `{ job: CompileJobResponse }` with `status = "queued"`.
- **R2.2** — `GET /api/v1/projects/:projectId/compile`: list jobs for the project (most recent 20).
  - Response 200: `{ jobs: CompileJobResponse[] }`.
- **R2.3** — `GET /api/v1/projects/:projectId/compile/:jobId`: get a single job (status, diagnostics, latestArtifactId).
  - Response 200: `{ job: CompileJobResponse }`.
- **R2.4** — `GET /api/v1/projects/:projectId/compile/:jobId/artifact`: stream the latest artifact bytes (PDF), or 404 if not yet produced.
  - Response 200: `application/pdf` body; `Content-Length` and `ETag = sha256` set.
- **R2.5** — Job status transitions: `queued -> running -> success | failed`. Diagnostics is a JSON array of `CompileDiagnosticDto` entries with this shape:
  ```ts
  {
    severity: "error" | "warning" | "hint" | "info",
    message: string,
    file?: string,                 // project-relative; omit only for project-wide errors
    range?: {
      start: { line: number, column: number },   // 1-based, matches typst CLI
      end:   { line: number, column: number },
    },
    hints?: string[],              // typst "help:" notes
  }
  ```
  The `range` field is REQUIRED whenever the compiler produced a source location, so the frontend can render an inline squiggle and gutter marker the same way as client-side WASM diagnostics. Diagnostics without a range still render in the Issues panel but are skipped by the inline lint extension.

**Acceptance**:
- `npm run test:unit:compile` passes for state transitions, the diagnostic Zod schema, and the typst stderr parser (covering at least: single error with location, error with hints, warning, two errors in different files, an error without a location).
- A queued job, when picked up by the worker, ends as `success` with a non-empty `latestArtifactId` for a minimal `Hello, world` Typst document.
- A queued job for a document with `#let x =` ends as `failed` with at least one diagnostic where `severity = "error"`, `file = "main.typ"`, `range.start.line` matches the offending line, and `message` is non-empty.

### R3. Server-side compile worker

- **R3.1**: The compile module owns a `TypstCompileService` port in domain and a `NodeTypstCompileService` infra implementation.
- **R3.2**: Worker reads files via `GetFilesForCompilation` use case (already exists), writes them to a temp working directory, invokes the Typst compiler, captures diagnostics, and stores the produced PDF as a `CompileArtifact`.
- **R3.3**: The worker must not block the Fastify event loop; either run inline using `child_process` with timeouts, or via a `BullMQ` queue when `REDIS_URL` is configured. MVP: in-process queue (FIFO, single worker) gated behind `COMPILE_WORKER_ENABLED=true`.
- **R3.4**: A failed compile returns `status = "failed"` with `diagnostics` populated (per R2.5) and no artifact.
- **R3.5**: `NodeTypstCompileService` invokes `typst compile --diagnostic-format=short` and parses the single-line form into the `CompileDiagnostic` shape. File paths in the parsed output MUST be normalised to project-relative (strip the temp `workDir` prefix, use forward slashes) so the frontend can match diagnostics to its `files` map.
- **R3.6**: When the installed typst is too old to support `--diagnostic-format=short`, `NodeTypstCompileService` MUST detect this at startup (probe `typst --version`) and either fall back to a parser for the fancy form or refuse to start with a clear error log. It MUST NOT silently emit diagnostics without ranges.

**Acceptance**:
- With `COMPILE_WORKER_ENABLED=true`, posting an invalid Typst document yields a `failed` job with at least one diagnostic that includes `range.start.line/column`; posting a valid document yields a `success` job with a downloadable PDF.
- Diagnostic `file` is project-relative (e.g. `chapters/intro.typ`), never an absolute temp path.

### R4. Artifact + binary file storage abstraction

- **R4.1**: A `BlobStorage` port in `backend/src/shared/storage/`. Operations: `put(key, stream, contentType): Promise<{ sizeBytes, sha256 }>`, `get(key): Promise<Readable>`, `delete(key)`, `head(key): Promise<{ sizeBytes, sha256 } | null>`.
- **R4.2**: `LocalBlobStorage` implementation writing to `process.env.STORAGE_DIR ?? "./.storage"`. Each blob lives at `{STORAGE_DIR}/{first2chars}/{sha256}.bin` with metadata sidecar.
- **R4.3**: `S3BlobStorage` placeholder (interface only; throws `NOT_IMPLEMENTED`) to make swap-in trivial later.
- **R4.4**: Storage selected by `BLOB_STORAGE_DRIVER=local|s3` env (default `local`).
- **R4.5**: Both `CompileArtifact` and `File.storageKey` (when `kind` is `image`/`data`) use this port.

**Acceptance**:
- `LocalBlobStorage` round-trips a 5KB buffer with stable `sha256`. `head` after `put` returns the same metadata.
- A successful compile job has an artifact retrievable via `GET .../artifact`.

### R5. ProjectSettings HTTP surface

- **R5.1** — `GET /api/v1/projects/:projectId/settings`: returns `{ settings: ProjectSettingsResponse }`. Auto-create row on first read with `mainPath = "main.typ"` if missing.
- **R5.2** — `PUT /api/v1/projects/:projectId/settings`: accepts a partial body; validates `mainPath` is a relative path inside the project, that any specified file exists, and that `compileOptions` is a known shape (Zod).
- **R5.3** — Reads and writes go through a new `project-settings` sub-module (or attached to `projects` module — pick one and document it in `design.md`).

**Acceptance**:
- A new project automatically has settings on first `GET`.
- `PUT` with `mainPath = "../escape.typ"` returns `400 INVALID_MAIN_PATH`.

### R6. Editor-friendly project-files behavior

- **R6.1** — `GET /api/v1/projects/:projectId/files/*` for a `kind = image|data` file should stream binary bytes (current implementation may serialize as JSON; confirm and adjust).
- **R6.2** — `PUT` for text files (`kind = typst|bib`) should update `lastEditedAt` on the file and on the parent project.
- **R6.3** — `POST` should reject creating a file at a path that already exists (`409 FILE_PATH_CONFLICT`).
- **R6.4** — `PATCH .../files:rename` should reject if target path exists (`409`).

**Acceptance**:
- `npm run test:api:project-files` passes including the new conflict cases.

### R7. Health and discoverability

- **R7.1**: All new routes appear in Swagger at `/docs`.
- **R7.2**: `backend/src/app.ts` route table comment is updated to list the compile and settings routes.

**Acceptance**:
- Visiting `/docs` lists `compile` and `project-settings` tags.

## Non-Functional Requirements

- **Type safety**: every new route has a Zod-validated DTO; no `any` in delivery code.
- **Observability**: each compile job logs `{ jobId, projectId, status, durationMs }` on transition.
- **Security**: artifacts and binary file content must not be served without project access checks.
- **Performance**: compile timeout `COMPILE_TIMEOUT_MS` (default 60s). Beyond that, the worker terminates the process and marks the job failed.
- **Build & test**: `cd backend && npm run build` and `npm run test:unit` continue to pass at every task boundary.

## Out of scope notes

- Real Typst CLI integration may need a system binary (`typst`) on PATH; if unavailable, the worker logs a clear startup error and stays disabled. Frontend client-side preview keeps working in this case.
- Snapshot endpoints (`ProjectSnapshot`) are intentionally not in MVP — local IndexedDB cache on the frontend is enough until collaboration arrives.

## Open Questions

1. Should compile jobs deduplicate when an identical request is queued within a few seconds? — Recommendation: yes, return the existing queued/running job. Defer to design doc.
2. Should artifacts be retained forever or rotate? — Recommendation: keep the latest 5 per project, soft-deletable. Defer to a follow-up spec.
3. Does the backend need its own Typst preview endpoint, or is client-side WASM preview enough? — Recommendation: client-side only for now; server is for export.
