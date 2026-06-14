# Project Structure

## Top-Level Layout

```
src/
  api/          # Route assembly / API mounting
  config/       # App config and env parsing
  generated/    # Prisma client (generated output, do not edit manually)
  modules/      # Vertical feature modules
  plugins/      # Fastify plugins and framework wiring
  shared/       # Cross-module generic utilities
  swagger/      # OpenAPI / Swagger setup
  types/        # Fastify / runtime type augmentations
  app.ts        # App bootstrap / plugin registration
  index.ts      # Process entrypoint
prisma/
  schema.prisma # Database schema
  migrations/   # SQL migration history
```

## Module Structure

Each feature module under `src/modules/<name>/` follows this layout:

```
<module>/
  domain/         # entities, types, ports, policies, domain errors
  application/    # use cases, commands, orchestration, result types
  infra/          # repository implementations, external adapters
  delivery/
    http/
      Routes.ts   # Fastify route registration
      Dto.ts      # request/response validation schemas
    ws/           # websocket handlers (only if needed)
  Container.ts    # dependency wiring for the module (optional but preferred)
  index.ts        # module public API / exports (optional but preferred)
```

## Current Modules

| Module | Responsibility |
|---|---|
| `auth` | Login, current user, logout (JWT revoke), change-password (no refresh token, no SSO yet) |
| `admin` | Faculties, departments, majors, classes, teacher/student management, accounts (XLSX/CSV import) |
| `teachers` | Authenticated teacher profile (`/teachers/me`) |
| `projects` | Project CRUD, settings, membership, share links, zip import/export, admin oversight |
| `project-files` | File CRUD + binary upload/download within projects |
| `compile` | Typst compile job queue, results, and artifact serving (incl. admin PDF) |
| `templates` | Project templates, versions, source-project authoring, publish |
| `bibliography` | `.bib` duplicate checks shared by Zotero/OpenAlex/Capture |
| `zotero` | Zotero connection, sync, collections/items |
| `openalex` | OpenAlex work search + import to project bibliography |
| `capture` | Web-to-cite reference capture into project bibliography |

`health` lives at `src/api/health.ts` (not a module). The `student`, `teacher`, and `artifacts` directories exist but are **empty placeholders** — the live teacher profile is the `teachers` module, and artifacts are served by `compile`.

## Plugins

Fastify plugins in `src/plugins/` are registered app-wide (registration order in `app.ts`: Config → CORS → Prisma → Storage → Multipart → JWT → TokenCleanup → Swagger):
- `Config.ts` — validates env and decorates `app.config`
- `Prisma.ts` — decorates `app.prisma` with a pooled PrismaClient
- `Storage.ts` — decorates `app.storage` (local filesystem blob storage)
- `Multipart.ts` — registers `@fastify/multipart` for file uploads
- `JWT.ts` — registers `@fastify/jwt` and decorates `app.auth` (`verify`, `requireAdmin`, `requireRoles`)
- `TokenCleanup.ts` — periodic cleanup of expired `InvalidToken` rows
- Swagger is registered from `src/swagger/` unless `ENABLE_SWAGGER=false`

## Fastify Instance Decorations

Defined in `src/types/fastify.d.ts`:
- `app.prisma` — PrismaClient instance
- `app.config` — typed app config object (db, auth, storage, templateStorage, bibliography, ...)
- `app.storage` — local blob storage adapter
- `app.auth.verify(req, reply)` — JWT verification + token revocation check
- `app.auth.requireAdmin` / `app.auth.requireRoles([...])` — role guards
- `app.materializeTemplate` — template → project materialization helper

## Conventions

- **Routes.ts** registers Fastify routes; use `app.auth.verify` as a `preHandler` for protected routes
- **Dto.ts** defines Zod schemas; use `@asteasolutions/zod-to-openapi` for OpenAPI annotations
- All imports use `.js` extensions (ESM NodeNext requirement), even for `.ts` source files
- Path aliases `@modules/*`, `@shared/*`, `@config` are defined in `tsconfig.json`, but existing code uses **relative imports with `.js` extensions** and the default `npm run build` (plain `tsc`) does not rewrite alias paths — prefer relative `.js` imports unless you also run `npm run build:aliases` (`tsc-alias`)
- Prisma client is imported from `src/generated/prisma/client.js`, not from `@prisma/client`
