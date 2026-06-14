# Tech Stack

## Runtime & Language
- **Node.js** with **TypeScript** (ESM, `"type": "module"`)
- Target: ES2023, module resolution: NodeNext
- Strict TypeScript: `noUnusedLocals`, `noUnusedParameters`, `strict: true`

## Framework
- **Fastify v5** — HTTP server
- **fastify-plugin** — for encapsulated plugins
- **@fastify/jwt** — JWT auth
- **@fastify/cors** — CORS
- **@fastify/multipart** — file uploads
- **@fastify/swagger** + **@fastify/swagger-ui** — OpenAPI docs at `/docs`

## Database
- **PostgreSQL**
- **Prisma ORM**
- Prisma schema at `prisma/schema.prisma`
- Prisma client generated into the project codebase
- `pg` + `@prisma/adapter-pg` are used for PostgreSQL integration


## Validation
- **Zod v4** for env config and request/response DTOs
- **@asteasolutions/zod-to-openapi** for OpenAPI schema generation
- **zod-to-json-schema** for JSON schema conversion

## Typst Compilation
- `@myriaddreamin/typst-ts-node-compiler` — server-side Typst compiler
- `@myriaddreamin/typst.ts` — Typst runtime

## Typst / Editor Integration

### Backend-side
- `@myriaddreamin/typst-ts-node-compiler` — authoritative server-side Typst compile pipeline
- `@myriaddreamin/typst.ts` — Typst runtime support

### System-level integration note
The overall platform is designed around a **hybrid editor**:
- frontend may provide fast/local feedback
- backend owns official compile/export behavior

## Other Libraries

- `bcrypt` + `bcryptjs` — password hashing
- `ws` — WebSocket support (collaboration transport; `y-websocket` is **not** installed yet)
- `xlsx` + `csv-parse` — spreadsheet / CSV parsing (admin import)
- `adm-zip` + `archiver` — project zip import/export
- `lru-cache` — caching
- `yaml` — YAML parsing
- `dotenv` — environment variable loading

## Path Aliases

`tsconfig.json` **does** define these path aliases:
- `@modules/*` → `src/modules/*`
- `@shared/*` → `src/shared/*`
- `@config` → `src/config/index.ts`

Caveat: the default `npm run build` is plain `tsc`, which does **not** rewrite alias imports to relative paths, so alias imports would fail at runtime (NodeNext does not resolve `tsconfig` paths at runtime). A separate `npm run build:aliases` runs `tsc-alias` to rewrite them. The existing codebase mostly uses **relative imports with `.js` extensions**; prefer that unless you deliberately adopt the alias build.

## Current Commands (from `package.json`)

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload (`tsx watch`) |
| `npm run build` | `tsc` compile to `dist/` + copy `src/generated` (Prisma client) |
| `npm run build:aliases` | `tsc` + `tsc-alias` (resolves `@modules`/`@shared`/`@config`) |
| `npm start` | Run compiled output from `dist/` |
| `npm run prisma:generate` | Regenerate Prisma client (`prisma generate`) |
| `npm run prisma:migrate` | `prisma migrate dev` (do **not** run automatically) |
| `npm run seed:users` / `seed:admin` / `seed:projects` / `seed:templates` / `seed:all` | Seed scripts |
| `npm run test:unit` | All unit tests (projects, project-files, compile, templates, zotero, capture) |
| `npm run test:unit:<area>` | Focused unit tests for one module |
| `npm run test:api:<area>` | API smoke tests (health, login, auth, projects, project-files, compile, templates, admin:*) — need a running server + DB |
| `npm test` | `test:unit` + `test:api:stage1` |

## Environment Variables

Expected runtime configuration typically includes:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — JWT signing secret
- `PORT` — server port
- `HOST` — bind address
- `SWAGGER_ROUTE_PREFIX` — Swagger UI route prefix
