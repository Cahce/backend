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

- `bcryptjs` — password hashing
- `ws` — WebSocket support
- `y-websocket` — collaboration-related transport support
- `xlsx` — spreadsheet parsing
- `dotenv` — environment variable loading

## Path Aliases

**Important:** path aliases are **not currently configured in the uploaded `tsconfig.json`**.

That means Kiro should **not** assume these aliases exist yet:
- `@modules/*`
- `@shared/*`
- `@config`

Only add them to steering after you actually configure them in `tsconfig.json`.

## Current Commands (based on existing package.json)

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output from `dist/` |

## Recommended Commands to add later

These are recommended, but should not be treated as already existing until you add them to `package.json`:

| Command | Description |
|---|---|
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run prisma:migrate` | Run database migrations in development |
| `npm run test:api:smoke` | Smoke-test backend API |
| `npm run test:api:auth` | Smoke-test auth-related API flow |

## Environment Variables

Expected runtime configuration typically includes:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — JWT signing secret
- `PORT` — server port
- `HOST` — bind address
- `SWAGGER_ROUTE_PREFIX` — Swagger UI route prefix
