# Backend context for Claude

This is the **backend** workspace of the TLU Scholar Editor: a Fastify 5 modular monolith with Clean Architecture (TypeScript ESM, Prisma 7 on PostgreSQL, Zod, JWT, Swagger/OpenAPI). It powers a hybrid Typst editing platform where the backend is the source of truth for persistence, auth, collaboration, and official compile/export.

This workspace has its own Kiro guidance under `backend/.kiro/` and a Codex entry file at `backend/AGENTS.MD`. The files below are imported so Claude Code reads the same source of truth as Kiro and Codex. **Do not duplicate or rewrite the imported files** — edit them in place.

The repo-root `CLAUDE.md` and its `.kiro/steering/*` integration guidance still apply on top of this. When both agree, follow them; the backend rules here are authoritative for backend-internal structure.

## Always-loaded backend steering

These mirror Kiro's always-included steering (`inclusion: always`, or no frontmatter which defaults to always):

@.kiro/steering/product.md
@.kiro/steering/tech.md
@.kiro/steering/structure.md
@.kiro/steering/architecture-rules.md
@.kiro/steering/database-evolution.md
@.kiro/steering/editor-hybrid.md

## On-demand backend steering

- `.kiro/steering/typst-editor-references.md` — (`inclusion: manual`) deep notes on the `texlyre` / `typst-online-editor` reference repos, CodeMirror/PDF.js/diagnostics integration, and our backend-authoritative hybrid model. Read before Typst compile/preview/diagnostics work.

## On-demand backend skills

Kiro skills live in `backend/.kiro/skills/<name>/SKILL.md`:

- `plan-backend-implementation` — determine target module, layer, affected files, and reasons before any backend code change.
- `review-architecture-boundary` — check a backend file/refactor/generated code for Clean Architecture boundary violations.
- `review-prisma-schema-change` — produce a structured schema-change analysis before any Prisma/database modification.

## Specialized backend sub-agents

Kiro agents live in `backend/.kiro/agents/`. These are Kiro-format playbooks and are **not** auto-registered as Claude Code subagent types; launch the matching behavior via the Agent tool or follow the file directly:

- `backend-agent` — implement backend features within Clean Architecture boundaries.
- `code-review-agent` — review backend code for boundary violations, naming consistency, framework leakage, refactor opportunities.
- `schema-reviewer` — review Prisma schema changes for correctness, migration safety, module boundaries, downstream impact.
- `api-contract-agent` — design/review DTOs, Swagger/OpenAPI contracts, Vietnamese API messages, Bearer-auth endpoint docs.
- `api-test-agent` — prepare manual API verification flows, Swagger checklists, auth token usage steps.
- `compile-debug-agent` — diagnose/improve the Typst compile pipeline (requests, diagnostics, artifacts, failure analysis).
- `zotero-integration-agent` — implement/review Zotero connection, sync, bibliography import, project citation flows.

## Backend automation (Kiro hooks — not executed by Claude)

`backend/.kiro/hooks/*.kiro.hook` define Kiro-side automation that Claude Code does **not** run (only the repo-root `.claude/hooks/hooks.json` is wired into `.claude/settings.json`). Apply these as manual reminders:

- `plan-before-implementation` — read steering and produce a structured plan before any task.
- `review-architecture-boundary` — review saved module TS files for boundary violations.
- `review-prisma-schema-change` — review `prisma/schema.prisma` saves for correctness, migration impact, and hybrid-editor compatibility.
- `build-and-smoke-test-api` — run a TypeScript build + API smoke test after a spec task completes.
- `auto-git-commit` — **intentionally not applied**: it conflicts with the repo hard rule "do not run `git commit` automatically".

## Backend hard rules (distilled from `backend/AGENTS.MD`)

- Vertical modules under `src/modules/<name>/` with layers `domain` / `application` / `infra` / `delivery/http` (+ `delivery/ws` only if needed).
- Dependency direction: `delivery -> application -> domain`; `infra -> domain/application` only through ports/interfaces. `domain` must not import Fastify/Prisma/Zod/bcrypt/JWT; `application` must not import Fastify/Prisma/`delivery`; `delivery` must not query the database directly.
- No Express, NestJS, or Mongoose. No Prisma queries outside `infra`. No business logic in route handlers. Do not invent a new architecture when extending an existing module.
- Prisma client is imported from `src/generated/prisma/client.js` (not `@prisma/client`). Use `.js` import extensions everywhere (ESM NodeNext). Do not assume path aliases exist unless `tsconfig.json` actually defines them.
- Storage is **local filesystem only**; storage logic lives in `infra` behind ports. Do not introduce S3/R2/cloud object storage abstractions unless explicitly requested.
- Read env only in `src/config/`; never hardcode secrets; keep `.env.example` updated when adding a variable.
- Do not assume planned modules (`student`, `teacher`) or unlisted commands (`prisma:*`, `test:api:*`) exist unless they are present in `package.json`.
- Do not change `prisma/schema.prisma` silently — first state the problem, proposed change, affected modules/use cases, migration impact, backfill/compat concerns, API contract impact, and rollback strategy.
- The editor is hybrid: client preview is fast feedback only; backend compile/export is the official result and saved state must be server-backed.
