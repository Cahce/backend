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
| `auth` | Login, logout, token refresh, SSO |
| `admin` | Admin user/system management |
| `student` | Student profile management |
| `teacher` | Teacher profile management |
| `projects` | Project CRUD, membership, share links |
| `project-files` | File upload/download within projects |
| `compile` | Typst compile job queue and results |
| `artifacts` | Compiled output (PDF) storage and retrieval |
| `templates` | Project templates |
| `zotero` | Zotero bibliography integration |

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
- Use path aliases (`@modules/`, `@shared/`, `@config`) instead of relative paths across module boundaries
- Prisma client is imported from `src/generated/prisma/client.js`, not from `@prisma/client`
