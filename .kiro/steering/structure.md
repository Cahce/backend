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

These are the modules that actually exist under `src/modules/` (verified against the tree):

| Module | Responsibility |
|---|---|
| `auth` | Login, logout, change-password, current-user / user lookup (JWT + token revocation) |
| `admin` | Admin academic structure (faculty/department/major/class), teacher/student profile & account management, XLSX/CSV import |
| `teachers` | Teacher profile (`/api/v1/teachers/me`) — the live teacher module |
| `projects` | Project CRUD, settings, membership, share links, zip import/export, admin oversight |
| `project-files` | File-tree CRUD + binary upload within projects |
| `compile` | Typst compile job queue, artifacts, official compile/export |
| `templates` | Project templates + versions + source-project authoring |
| `bibliography` | `.bib`/Hayagriva parsing, serialization, citation-key + duplicate detection (no infra: pure logic + project-files port) |
| `zotero` | Zotero connection + sync into the project bibliography |
| `openalex` | OpenAlex search + import into the project bibliography |
| `capture` | Web-to-cite capture (translation-server + OpenAlex fallback) |

> The empty placeholder directories `student/`, `teacher/`, and `artifacts/` were removed — they
> contained no code. Student/teacher data lives under `admin` (and the live teacher profile under
> `teachers`); compiled artifacts are served from `compile`. Do not recreate empty module shells.

## Plugins

Fastify plugins in `src/plugins/` are registered app-wide via `fastify-plugin`:
- `Prisma.ts` — decorates `app.prisma` with a pooled PrismaClient
- `JWT.ts` — registers `@fastify/jwt` and decorates `app.auth.verify` for route-level auth guards

## Fastify Instance Decorations

Defined in `src/types/fastify.d.ts`:
- `app.prisma` — PrismaClient instance
- `app.config` — typed app config object
- `app.auth.verify(req, reply)` — JWT verification + token revocation check

## Conventions

- **Routes.ts** registers Fastify routes; use `app.auth.verify` as a `preHandler` for protected routes
- **Dto.ts** defines Zod schemas; use `@asteasolutions/zod-to-openapi` for OpenAPI annotations
- All imports use `.js` extensions (ESM NodeNext requirement), even for `.ts` source files
- Use relative imports with `.js` extensions across module boundaries. **Path aliases are intentionally
  NOT configured** (the unused `@modules/@shared/@config` `paths` block + the `build:aliases` script were
  removed, since the default `build` runs plain `tsc` and would not rewrite alias paths at runtime). See `tech.md`.
- Prisma client is imported from `src/generated/prisma/client.js`, not from `@prisma/client`
