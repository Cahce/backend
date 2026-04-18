# Backend Workspace Agent Instructions

This workspace is the **backend** of a collaborative Typst document editing platform.

The backend must follow:
- **Modular Monolith**
- **Clean Architecture**
- **Backend-authoritative rules**
- **Hybrid editor compatibility**

---

## 1. Workspace Scope

This workspace focuses on backend implementation only.

Do:
- work inside backend code and configuration
- preserve architecture boundaries
- maintain compatibility with the hybrid editor model
- keep generated code aligned with the existing project structure

Do not:
- generate frontend code here
- assume non-existing modules already exist
- invent a different architecture style
- introduce Express, NestJS, or Mongoose-based solutions
- hardcode secrets in source code
- introduce S3 / R2 / cloud object storage assumptions unless explicitly requested

---

## 2. Product Context

This backend powers a collaborative Typst platform.

Core backend responsibilities:
- authentication and authorization
- project and file persistence
- collaboration support
- official compile/export behavior
- artifacts, quotas, analytics, and policy enforcement
- Zotero integration for bibliography-related workflows

The overall editor model is **hybrid**:
- frontend may provide fast/local feedback
- backend is authoritative for saved state, collaboration synchronization, and official compile/export results

### Current storage strategy
- file storage is currently **local filesystem storage**
- compile outputs / artifacts are currently stored locally
- do not assume cloud object storage is available
- future cloud storage support may be added later, but only when explicitly requested

---

## 3. Architecture Rules

### Architectural style
Organize backend by vertical modules under `src/modules/`.

Each module should follow:
- `domain`
- `application`
- `infra`
- `delivery/http`
- `delivery/ws` (only if needed)

### Dependency direction
Allowed:
- `delivery -> application -> domain`
- `infra -> domain/application` only through ports/interfaces

Forbidden:
- `domain` importing Fastify, Prisma, Zod, bcrypt, JWT, or any framework
- `application` importing Fastify, Prisma, or `delivery`
- `delivery` querying the database directly

### Layer responsibilities
- `domain`: entities, types, ports, policies, domain errors
- `application`: use cases, commands, orchestration, result types
- `infra`: Prisma repositories, hashing adapters, JWT adapters, compiler adapters, local filesystem storage adapters
- `delivery/http`: routes, DTOs, validation, HTTP mapping
- `plugins`: framework wiring only
- `shared`: generic helpers only, no module business logic

### Composition
- wire dependencies centrally
- do not create heavy dependencies repeatedly inside handlers

### API discipline
- `delivery` validates input
- `application` returns typed results
- `delivery` maps results to HTTP responses

### Hard rules
- do not generate Express code
- do not generate NestJS code
- do not generate Mongoose-based repositories
- do not place Prisma queries outside `infra`
- do not place business logic in route handlers
- do not invent a new architecture when extending an existing module
- do not introduce cloud storage abstractions unless the task explicitly requires future storage extensibility

---

## 4. Actual Backend Structure

Backend top-level structure:

```text
src/
  api/
  config/
  generated/
  modules/
  plugins/
  shared/
  swagger/
  types/
  app.ts
  index.ts

prisma/
  schema.prisma
  migrations/
  Actual current modules:

auth
admin
projects
project-files
templates
compile
artifacts
zotero
health

Planned / future modules may include:

student
teacher

Do not assume planned modules already exist unless explicitly asked to create them.

5. Module Responsibility Hints
auth: authentication, password/token flow, auth introspection
admin: administrative operations and system-level actions
projects: project lifecycle, ownership, membership, share-related rules
project-files: file lifecycle inside projects, uploads/downloads, file metadata
templates: template-related logic and template application flow
compile: compile orchestration, compile jobs, diagnostics pipeline
artifacts: exported/compiled outputs and artifact retrieval
zotero: bibliography / reference integration workflows
health: service health endpoint(s)

When implementing new behavior, choose the module that owns the business rule.
Do not spread one business rule across multiple modules without explicit reason.

6. Hybrid Editor Rules

The editor is intentionally hybrid.

Client-side responsibilities
low-latency typing experience
local interaction state
cursor/selection/awareness UX
fast preview when appropriate
rendering diagnostics returned by backend
Server-side responsibilities
authenticated collaboration sessions
persistence of source state
snapshots/versioning lifecycle
authoritative compile/export
artifact storage
permission and quota enforcement
Authoritative rules
local preview is fast feedback only
backend compile/export is the official result
saved state must be server-backed
frontend must not become the sole source of truth
Compile split
fast preview may happen on the client
official compile/export must happen on the backend
backend diagnostics are authoritative for saved/exported state

When implementing editor-related features, always decide:

what happens instantly on client
what must synchronize to server
what must be compiled officially on server
what contract connects both sides
7. Database Evolution Rules

Database redesign is allowed only when the current schema is incomplete or inconsistent with domain rules.

Allowed reasons for schema redesign
missing entities or relationships
wrong cardinality
missing unique constraints
missing indexes for important queries
wrong lifecycle/status modeling
missing audit/history fields
poor separation between bounded contexts
schema does not support required use cases cleanly
Constraints
do NOT change schema silently
do NOT redesign schema for style preference alone
prefer minimal schema changes that improve correctness
keep schema aligned with module boundaries
update Prisma schema, repositories, DTOs, and use cases consistently
Schema review mindset

Before changing Prisma schema, always think through:

current problem
proposed schema changes
affected modules/use cases
migration impact
data backfill or compatibility concerns
API contract impact
rollback strategy
Hybrid-editor-aware schema review

Also check whether schema supports:

persisted editor source state
file versioning or snapshots
compile job tracking
compiled artifacts
collaboration/session metadata
traceability from source to output artifact
project file metadata and file lifecycle
8. Technical Reality Checks
Current technical baseline
Fastify backend
Prisma + PostgreSQL
Zod for validation
Typst Node compiler on backend
WebSocket support in backend
local filesystem storage for uploads / artifacts / compile outputs
Important warnings
do not assume path aliases exist unless tsconfig.json actually defines paths
do not assume Prisma commands or smoke-test scripts already exist unless package.json contains them
do not claim a command exists unless it is present in the workspace
use .js extensions in import paths where required by the workspace's ESM / NodeNext setup
do not assume S3, R2, MinIO, or other object storage exists in the current deployment
9. Naming Rules

Follow these naming rules strictly.

Files
File names: PascalCase
Examples:
LoginUseCase.ts
UserRepoPrisma.ts
Routes.ts
Dto.ts
AuthErrors.ts
Folders
Feature/module folders: lowercase
Examples:
auth
projects
project-files
compile
Types
Class / Type / Interface / Enum: PascalCase
Examples:
LoginCommand
UserRole
AuthPorts
CompileStatus
Functions and variables
Function names: camelCase
Variable names: camelCase
Examples:
loginUseCase
mapUserToView
tokenPayload
compileResult
Constants
Module-level constants: UPPER_SNAKE_CASE
Examples:
DEFAULT_PAGE_SIZE
MAX_UPLOAD_SIZE
JWT_ALGORITHM
Boolean naming

Prefer prefixes:

is
has
can
should

Examples:

isActive
hasPermission
canCompile
shouldRetry
DTO naming

Request DTO / schema names should be explicit.
Examples:

LoginRequestDto
CreateProjectRequestDto
UploadProjectFileRequestDto
CompileDocumentResponseDto
Use case naming

Use case files and exported symbols should end with UseCase.
Examples:

LoginUseCase.ts
CompileDocumentUseCase.ts
UploadProjectFileUseCase.ts
Repository / adapter naming

Infra adapters should reflect implementation technology.
Examples:

UserRepoPrisma.ts
PasswordHasherBcrypt.ts
JwtTokenServiceFastify.ts
ArtifactStorageLocal.ts
ProjectFileStorageLocal.ts
ZoteroClientHttp.ts
Route naming
route registration file in delivery/http should be Routes.ts
validation / transport file in delivery/http should be Dto.ts
Prohibited naming behavior
do not mix snake_case with camelCase for functions/variables
do not create vague file names like helper.ts, service.ts, utils.ts in modules without bounded responsibility
do not invent inconsistent suffixes when an existing pattern already exists
10. Environment & Secrets Rules
General rules
never hardcode secrets in source code
never hardcode secrets in tests, examples, docs, or generated files
never commit real secret values into the repository
always use environment variables for secrets and deployment-specific values
always keep .env.example updated when introducing a new env variable
Secret handling rules

Treat the following as secrets unless explicitly known to be safe:

database credentials / database URLs
JWT secrets / signing keys
OAuth client secrets
LDAP bind passwords
SMTP credentials
Redis passwords / URLs with credentials
API keys and webhook secrets
internal service tokens
session encryption keys
Non-secret config examples

These may live in .env.example as defaults/placeholders:

PORT
HOST
NODE_ENV
SWAGGER_ROUTE_PREFIX
feature flags with safe defaults
timeout / retry / pagination defaults
local storage root paths
compile workdir root paths
Storage rule
current storage is local filesystem storage
local storage paths should be configurable via env
do not add S3 / R2 credentials to .env.example unless cloud storage is actually introduced later
Mandatory behavior

Whenever a new secret-bearing integration is added:

add the variable to .env.example
add config validation in src/config/
document whether it is required or optional
never place a real value in committed files
11. Config Access Rules
read env only in src/config/
validate env centrally
export typed config values from config layer
do not access raw process.env directly inside modules unless explicitly justified
when adding a new env variable:
update .env.example
update config validation
document whether it is required or optional
12. Local Storage Rules

Current storage implementation should assume local filesystem only.

Current expectation
uploads are stored locally
project files are stored locally
artifacts are stored locally
compile outputs are stored locally
storage paths should come from config/env, not be hardcoded inline across modules
Architectural rule
storage logic belongs in infra
use cases should depend on ports/interfaces, not directly on filesystem APIs
if future cloud storage is needed, it should be introduced as another infra adapter behind the same port
do not prematurely generalize for cloud providers if current task only needs local storage
13. Working Protocol Before Code Changes

Before writing code, always state:

target module
target layer
affected files
why those files belong to that layer
whether there is database impact
whether this affects hybrid editor behavior
whether this affects local storage behavior

Do not start implementation before the plan is clear.

14. Working Protocol For Schema Changes

Before touching Prisma schema, always state:

current problem
proposed schema changes
affected modules/use cases
migration impact
compatibility or backfill concerns
API contract impact
rollback strategy

Do not change schema silently.

15. Review Protocol

When reviewing backend code, always check:

correct module placement
correct layer placement
dependency direction violations
framework leakage into domain/application
direct DB access from delivery
naming convention mismatch
storage logic leaking outside infra

Prefer the smallest safe fix instead of a large rewrite.
16. Implementation Priority

Priority order for backend work:

P0
auth
health
projects
project-files
templates
file save/persist flow
hybrid editor session foundation
backend compile pipeline
artifact retrieval
stable local storage integration
P1
collaboration sync
snapshots/versioning
compile diagnostics refinement
membership/share flow
zotero integration
P2
analytics
quotas
teacher/admin dashboards
SSO
optional future cloud storage support

Do not prioritize bonus features before the hybrid editor loop and local storage flow are stable.

17. Response Style For This Workspace

When proposing changes:

be explicit
be conservative
preserve architecture
do not hallucinate missing files or modules
call out uncertainty clearly
separate actual repo state from proposed future design

When implementing:

prefer minimal changes
explain layer choice
mention downstream impact
mention schema impact when relevant
mention hybrid editor impact when relevant
mention local storage impact when relevant