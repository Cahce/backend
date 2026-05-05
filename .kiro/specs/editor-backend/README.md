# Editor Backend Spec

Replace mock-only editor backend with real HTTP surface for the hybrid Typst editor.

## Files

- `requirements.md` — what the backend must do, with acceptance criteria per requirement.
- `design.md` — directory structure, module-by-module plan, sample code for ports, infra, use cases, routes, and DTOs.
- `tasks.md` — ordered phases (T0 -> T5) with files, acceptance, and verification commands.

## Scope

In:
- Register `compile` module HTTP routes under `/api/v1/projects/:projectId/compile`.
- Add `ProjectSettings` HTTP routes (GET/PUT) under `/api/v1/projects/:projectId/settings`.
- Introduce a `BlobStorage` port + `LocalBlobStorage` adapter for compile artifacts and binary files.
- Tighten `project-files`: conflict codes, binary streaming, `lastEditedAt` propagation.

Out:
- Real-time collaboration / `ProjectSnapshot` endpoints.
- Zotero routes.
- Server-side preview (frontend uses WASM).
- S3 implementation (placeholder only).

## Pre-reads

- `.kiro/steering/backend-system-structure.md`
- `.kiro/steering/editor-hybrid-architecture.md`
- `.kiro/steering/typescript-best-practices.md`
- `.kiro/steering/security-best-practices.md`

## Coordinates with

- `.kiro/specs/editor-frontend/` — the frontend spec consumes the routes added here. See the dependency table in `editor-frontend/tasks.md`.
