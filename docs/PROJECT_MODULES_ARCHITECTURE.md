# Project/Editor Modules - Architecture Diagram

**Date**: April 18, 2026  
**Phase**: A - Analysis  
**Purpose**: Visual representation of module boundaries and interactions

---

## Module Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                         HTTP Layer (Delivery)                    │
│  /api/v1/projects  /api/v1/files  /api/v1/compile  /api/v1/...  │
└────────────┬────────────┬────────────┬────────────┬──────────────┘
             │            │            │            │
             ▼            ▼            ▼            ▼
┌────────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   projects     │  │project-files │  │   compile    │  │  artifacts   │
│   (Module)     │  │   (Module)   │  │   (Module)   │  │   (Module)   │
├────────────────┤  ├──────────────┤  ├──────────────┤  ├──────────────┤
│ • Project CRUD │  │ • File CRUD  │  │ • Job queue  │  │ • Store      │
│ • Ownership    │  │ • File tree  │  │ • Typst exec │  │ • Retrieve   │
│ • Collab       │  │ • Storage    │  │ • Diagnostic │  │ • Latest     │
│ • Settings     │  │              │  │              │  │              │
└────┬───────────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
     │                     ▲                  │                  ▲
     │                     │                  │                  │
     │         ┌───────────┴──────────────────┴──────────────────┘
     │         │           reads files        stores artifacts
     │         │
     ▼         │
┌────────────────┐         │
│   templates    │         │
│   (Module)     │         │
├────────────────┤         │
│ • Template     │         │
│   metadata     │         │
│ • Instantiate  │─────────┘
│                │  creates files
└────────────────┘

┌──────────────┐
│   zotero     │
│   (Module)   │
├──────────────┤
│ • Connection │
│ • Sync       │
│ • .bib gen   │─────────────────────────────────────────────────┐
└──────────────┘                                                  │
                                                                  │
                                                                  ▼
                                                          updates .bib file
```

---

## Hybrid Typst Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                            Frontend                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Monaco Editor                                                │  │
│  │  • User types Typst code                                      │  │
│  │  • Instant local preview (optional, fast feedback)            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                  │                                   │
│                                  │ HTTP POST /api/v1/compile         │
│                                  ▼                                   │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │
┌──────────────────────────────────┼───────────────────────────────────┐
│                            Backend│                                   │
│                                   ▼                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  compile Module (Authoritative)                              │  │
│  │  1. Create CompileJob (status: queued)                       │  │
│  │  2. Return job ID immediately                                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                   │                                   │
│                                   │ Background Worker                 │
│                                   ▼                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Compile Queue Processor                                     │  │
│  │  1. Fetch files from project-files module                    │  │
│  │  2. Invoke Typst compiler (@myriaddreamin/typst-ts-node)     │  │
│  │  3. Parse diagnostics                                        │  │
│  │  4. Store artifact via artifacts module                      │  │
│  │  5. Update CompileJob (status: success/failed)               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                   │                                   │
│                                   │                                   │
│                                   ▼                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  artifacts Module                                            │  │
│  │  • Store PDF/preview artifact                                │  │
│  │  • Store diagnostics                                         │  │
│  │  • Link to CompileJob                                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ Frontend polls GET /api/v1/compile/:jobId
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            Frontend                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Poll for job status                                          │  │
│  │  • If status = success → download artifact                    │  │
│  │  • If status = failed → show diagnostics                      │  │
│  │  • If status = running → keep polling                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Template Instantiation Flow

```
User: "Create project from template"
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  POST /api/v1/projects                                           │
│  Body: { templateVersionId, title, ... }                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  projects Module                                                 │
│  CreateProjectFromTemplateUseCase                                │
│  1. Validate template exists                                     │
│  2. Create Project record                                        │
│  3. Create ProjectSettings record                                │
│  4. Call templates.instantiateTemplate(versionId, projectId)     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  templates Module                                                │
│  InstantiateTemplateUseCase                                      │
│  1. Read template files from storage (ZIP archive)               │
│  2. Extract files                                                │
│  3. (Optional) Substitute variables                              │
│  4. Call project-files.createFilesFromTemplate(projectId, files) │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  project-files Module                                            │
│  CreateFilesFromTemplateUseCase                                  │
│  1. Validate file paths                                          │
│  2. Detect file kinds (typst, bib, image, etc.)                  │
│  3. Store files (inline or object storage)                       │
│  4. Create File records                                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    Project created with files!
```

---

## Zotero Integration Flow

```
User: "Sync Zotero bibliography"
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  POST /api/v1/zotero/sync                                        │
│  Body: { projectId }                                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  zotero Module                                                   │
│  SyncBibliographyUseCase                                         │
│  1. Get user's ZoteroConnection                                  │
│  2. Call Zotero API (fetch items)                                │
│  3. Generate .bib file content                                   │
│  4. Call project-files.updateFile(projectId, "refs.bib", content)│
│  5. Create ZoteroSyncLog record                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  project-files Module                                            │
│  UpdateFileUseCase                                               │
│  1. Find existing refs.bib file (or create new)                  │
│  2. Update textContent                                           │
│  3. Update lastEditedAt                                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    refs.bib updated!
                    (Typst can now use it)
```

---

## Module Interaction Rules

### ✅ Allowed Dependencies

```
projects       → templates       (instantiate template)
projects       → project-files   (initialize files)
compile        → project-files   (read files for compilation)
compile        → artifacts       (store compilation output)
templates      → project-files   (create template files)
zotero         → project-files   (update .bib file)
```

### ❌ Forbidden Dependencies

```
templates      ✗→ projects       (templates don't create projects)
project-files  ✗→ projects       (files don't manage projects)
project-files  ✗→ compile        (files don't trigger compilation)
artifacts      ✗→ compile        (artifacts don't orchestrate compilation)
compile        ✗→ projects       (compile doesn't manage projects)
```

### 🔄 Circular Dependencies (AVOID)

```
projects ←→ templates      (WRONG: use one-way dependency)
compile  ←→ artifacts      (WRONG: use one-way dependency)
```

---

## Clean Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                      Delivery Layer                              │
│  • HTTP Routes (Routes.ts)                                       │
│  • DTOs (Dto.ts)                                                 │
│  • Request validation (Zod schemas)                              │
│  • Response mapping                                              │
│  • Auth guards (preHandler)                                      │
└────────────────────────────┬────────────────────────────────────┘
                             │ calls
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Application Layer                             │
│  • Use Cases (CreateProjectUseCase, etc.)                        │
│  • Command/Query types                                           │
│  • Result types                                                  │
│  • Orchestration logic                                           │
│  • Cross-module coordination                                     │
└────────────────────────────┬────────────────────────────────────┘
                             │ uses
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Domain Layer                               │
│  • Entities (Project, File, CompileJob, etc.)                    │
│  • Value Objects                                                 │
│  • Domain Errors                                                 │
│  • Policies (business rules)                                     │
│  • Ports (interfaces for infra)                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │ implemented by
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                          │
│  • Repositories (Prisma implementations)                         │
│  • Adapters (Typst compiler, Zotero API, etc.)                  │
│  • Storage (local filesystem, object storage)                    │
│  • External services                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Compile Request

```
1. User clicks "Compile" in editor
   │
   ▼
2. Frontend: POST /api/v1/compile
   Body: { projectId, entryPath, mode: "preview" }
   │
   ▼
3. Delivery: CompileRoutes.ts
   • Validate request (Zod)
   • Check auth (app.auth.verify)
   • Check project access
   │
   ▼
4. Application: RequestCompileUseCase
   • Validate project exists
   • Create CompileJob (status: queued)
   • Return job ID
   │
   ▼
5. Delivery: Return 202 Accepted
   Response: { jobId, status: "queued" }
   │
   ▼
6. Background Worker: CompileQueueProcessor
   • Fetch job from queue
   • Update status: running
   │
   ▼
7. Application: ExecuteCompileUseCase
   • Call project-files.getFilesForCompilation(projectId, entryPath)
   • Get file tree + content
   │
   ▼
8. Infra: TypstCompilerAdapter
   • Invoke @myriaddreamin/typst-ts-node-compiler
   • Compile Typst → PDF
   • Parse diagnostics
   │
   ▼
9. Application: ExecuteCompileUseCase (continued)
   • Call artifacts.storeArtifact(jobId, projectId, pdfBuffer, "pdf")
   • Update CompileJob (status: success, latestArtifactId removed)
   │
   ▼
10. Frontend: Poll GET /api/v1/compile/:jobId
    • If status = success → GET /api/v1/artifacts/:artifactId
    • Download PDF and display
```

---

## Storage Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         File Storage                             │
│                                                                   │
│  ┌──────────────────┐              ┌──────────────────┐         │
│  │  Inline Storage  │              │ Object Storage   │         │
│  │  (textContent)   │              │  (storageKey)    │         │
│  ├──────────────────┤              ├──────────────────┤         │
│  │ • Small files    │              │ • Large files    │         │
│  │ • < 1MB          │              │ • > 1MB          │         │
│  │ • Typst source   │              │ • Images         │         │
│  │ • .bib files     │              │ • Data files     │         │
│  └──────────────────┘              └──────────────────┘         │
│         │                                    │                   │
│         │                                    │                   │
│         ▼                                    ▼                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              File.storageMode                            │  │
│  │  • inline → read from textContent                        │  │
│  │  • object_storage → read from storageKey                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Artifact Storage                            │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Local Filesystem (current)                              │  │
│  │  • /storage/artifacts/{artifactId}.pdf                   │  │
│  │  • CompileArtifact.storageKey = "artifacts/{id}.pdf"     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Object Storage (future)                                 │  │
│  │  • S3/R2/MinIO                                           │  │
│  │  • CompileArtifact.storageKey = "s3://bucket/key"        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     Template Storage                             │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ZIP Archive                                             │  │
│  │  • /storage/templates/{versionId}.zip                    │  │
│  │  • TemplateVersion.storageKey = "templates/{id}.zip"     │  │
│  │                                                          │  │
│  │  ZIP Contents:                                           │  │
│  │  ├── manifest.json (metadata, file list, variables)     │  │
│  │  ├── files/                                             │  │
│  │  │   ├── main.typ                                       │  │
│  │  │   ├── refs.bib                                       │  │
│  │  │   └── images/                                        │  │
│  │  │       └── logo.png                                   │  │
│  │  └── preview.png (optional)                             │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Security & Authorization

```
┌─────────────────────────────────────────────────────────────────┐
│                    Authorization Layers                          │
│                                                                   │
│  Layer 1: Route-level (Delivery)                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  preHandler: app.auth.verify                             │  │
│  │  • Verify JWT token                                      │  │
│  │  • Check token revocation                                │  │
│  │  • Populate request.user                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Layer 2: Resource-level (Application)                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Use Case: Check project access                          │  │
│  │  • Is user the owner?                                    │  │
│  │  • Is user a member (editor/viewer)?                     │  │
│  │  • Is user an advisor?                                   │  │
│  │  • Is user admin?                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Layer 3: Operation-level (Domain)                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Policy: Can user perform operation?                     │  │
│  │  • Viewer can read, not write                            │  │
│  │  • Editor can read and write                             │  │
│  │  • Owner can delete                                      │  │
│  │  • Admin can do anything                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Error Handling Flow

```
Domain Error (e.g., ProjectNotFoundError)
         │
         ▼
Application Layer catches and wraps
         │
         ▼
Returns Result<T> { success: false, error: { code, message } }
         │
         ▼
Delivery Layer maps to HTTP status
         │
         ├─> 400 Bad Request (validation errors)
         ├─> 401 Unauthorized (auth errors)
         ├─> 403 Forbidden (permission errors)
         ├─> 404 Not Found (resource not found)
         ├─> 409 Conflict (duplicate, constraint violation)
         └─> 500 Internal Server Error (unexpected errors)
```

---

**End of Architecture Diagram**
