# Project/Editor Modules - Gap Analysis & Architecture Proposal

**Date**: April 18, 2026  
**Phase**: A - Analysis Only (No Implementation)  
**Status**: 🔍 ANALYSIS

---

## Executive Summary

All six target modules (`projects`, `project-files`, `templates`, `compile`, `artifacts`, `zotero`) currently exist as **empty scaffolds** with only folder structure. The Prisma schema is **well-designed** and mostly sufficient for the hybrid Typst editor architecture, with only minor refinements needed.

**Key Finding**: The schema supports the hybrid architecture well, but module responsibilities need clear definition and implementation from scratch.

---

## Current State Analysis

### 1. **projects** Module

#### What Exists
- ✅ Folder structure (domain, application, infra, delivery/http, delivery/ws)
- ✅ Empty Routes.ts and Dto.ts files
- ✅ Prisma schema with `Project` model

#### Current Responsibility (Inferred from Schema)
The `Project` model owns:
- Project metadata (id, title, category, timestamps)
- Owner relationship (ownerId → User)
- Template relationship (templateId, templateVersionId)
- Collaboration metadata (members, shareLinks, advisors)
- Settings reference (ProjectSettings)
- Relations to files, compileJobs, artifacts, snapshots

#### What Is Missing
- ❌ **All business logic** (use cases, domain types, ports)
- ❌ Create project use case
- ❌ Create project from template use case
- ❌ List/get/update/delete project use cases
- ❌ Project ownership/permission policies
- ❌ Project member management use cases
- ❌ Share link generation/validation use cases
- ❌ Advisor assignment use cases
- ❌ Repository implementations
- ❌ HTTP routes and DTOs
- ❌ Container.ts for dependency wiring

#### What Is Wrongly Placed
- ⚠️ **None** - module is empty, nothing to be wrongly placed yet

#### Schema Evaluation
✅ **Sufficient** for core project management:
- `Project` - main entity
- `ProjectSettings` - compile/editor configuration
- `ProjectMember` - collaboration (editor/viewer roles)
- `ProjectShareLink` - invite links with expiration
- `ProjectAdvisor` - teacher advising relationship

**Minor Issue**: `Project.lastEditedAt` exists but no clear update mechanism defined.

---

### 2. **project-files** Module

#### What Exists
- ✅ Folder structure
- ✅ Empty Routes.ts and Dto.ts files
- ✅ Prisma schema with `File` model

#### Current Responsibility (Inferred from Schema)
The `File` model owns:
- File tree inside a project (projectId, path)
- File content (textContent for inline, storageKey for object storage)
- File metadata (kind, mimeType, sizeBytes, sha256)
- File timestamps (lastEditedAt, createdAt, updatedAt)

#### What Is Missing
- ❌ **All business logic**
- ❌ List files in project (file tree)
- ❌ Get file content use case
- ❌ Create/update file use case
- ❌ Rename file use case
- ❌ Delete file use case
- ❌ File kind detection policy
- ❌ File storage abstraction (inline vs object storage)
- ❌ File content validation (e.g., max size)
- ❌ Repository implementations
- ❌ HTTP routes and DTOs

#### What Is Wrongly Placed
- ⚠️ **None** - module is empty

#### Schema Evaluation
✅ **Mostly sufficient** for file management:
- `File.path` - unique per project (file tree path)
- `File.kind` - enum (typst, bib, image, data, other)
- `File.textContent` - inline storage for small files
- `File.storageKey` - reference to object storage for large files

**Potential Issue**: 
- No explicit `FileStorageMode` enum (inline vs object_storage)
- Ambiguity: when to use `textContent` vs `storageKey`?

**Recommendation**: Add `storageMode` field to make storage location explicit (see Phase 5 from migration doc).

---

### 3. **templates** Module

#### What Exists
- ✅ Folder structure
- ✅ Empty Routes.ts and Dto.ts files (no files at all)
- ✅ Prisma schema with `Template` and `TemplateVersion` models

#### Current Responsibility (Inferred from Schema)
The `Template` model owns:
- Template metadata (name, description, category)
- Template status (isOfficial, isActive)
- Template versions (TemplateVersion relation)

The `TemplateVersion` model owns:
- Version metadata (versionNumber, changelog)
- Template file snapshot (storageKey)
- Version status (isActive)

#### What Is Missing
- ❌ **All business logic**
- ❌ List templates use case (filter by category, official status)
- ❌ Get template details use case
- ❌ Get template version use case
- ❌ **Instantiate project from template use case** (CRITICAL)
- ❌ Template file structure definition
- ❌ Template variable substitution logic (if needed)
- ❌ Repository implementations
- ❌ HTTP routes and DTOs

#### What Is Wrongly Placed
- ⚠️ **None** - module is empty

#### Schema Evaluation
✅ **Sufficient** for template management:
- `Template` - template metadata
- `TemplateVersion` - versioned template snapshots
- `Project.templateId` and `Project.templateVersionId` - track template origin

**Question**: How are template files stored?
- `TemplateVersion.storageKey` suggests a single archive/bundle
- Need to define: ZIP file? Directory structure? JSON manifest?

**Recommendation**: Define template file format specification.

---

### 4. **compile** Module

#### What Exists
- ✅ Folder structure
- ✅ Empty Routes.ts and Dto.ts files
- ✅ Prisma schema with `CompileJob` model

#### Current Responsibility (Inferred from Schema)
The `CompileJob` model owns:
- Compile job metadata (projectId, entryPath)
- Job status (queued, running, success, failed)
- Compile mode (export, preview)
- Compile engine (node, web)
- Job execution metadata (attempt, priority, timestamps)
- Diagnostics (Json)
- Requester (requestedById → User)
- Latest artifact reference (latestArtifactId)

#### What Is Missing
- ❌ **All business logic**
- ❌ Request compile use case (preview mode)
- ❌ Request export use case (export mode)
- ❌ Get compile job status use case
- ❌ Get compile diagnostics use case
- ❌ Compile orchestration logic
- ❌ Typst compiler adapter (infra)
- ❌ File content resolver (get files for compilation)
- ❌ Diagnostics parser/formatter
- ❌ Repository implementations
- ❌ HTTP routes and DTOs
- ❌ Background job processor (if async)

#### What Is Wrongly Placed
- ⚠️ **None** - module is empty

#### Schema Evaluation
✅ **Well-designed** for hybrid compile architecture:
- `CompileJob` - tracks compile requests
- `CompileStatus` enum - job lifecycle
- `CompileMode` enum - preview vs export
- `CompileEngine` enum - node (backend) vs web (frontend hint)
- `diagnostics` Json - flexible diagnostics storage
- `latestArtifactId` - quick access to latest result

**Potential Issues**:
1. **Circular dependency**: `CompileJob.latestArtifactId` ↔ `CompileArtifact.latestOfJob`
   - This was flagged in Phase 5 of migration doc
   - Recommendation: Remove `latestArtifactId`, query latest artifact by `ORDER BY createdAt DESC LIMIT 1`

2. **No compile queue priority logic defined**
   - `priority` field exists but no policy

3. **No retry policy defined**
   - `attempt` field exists but no max attempts policy

**Recommendation**: 
- Remove circular dependency
- Define compile queue policies in domain layer

---

### 5. **artifacts** Module

#### What Exists
- ✅ Folder structure
- ✅ **No files at all** (not even empty Routes.ts/Dto.ts)
- ✅ Prisma schema with `CompileArtifact` model

#### Current Responsibility (Inferred from Schema)
The `CompileArtifact` model owns:
- Artifact metadata (projectId, jobId)
- Artifact format (default "pdf")
- Artifact storage (storageKey)
- Artifact metadata (sizeBytes, sha256)
- Artifact timestamp (createdAt)

#### What Is Missing
- ❌ **All business logic**
- ❌ Get artifact by ID use case
- ❌ Get latest artifact for project use case
- ❌ Download artifact use case
- ❌ List artifacts for project use case
- ❌ Artifact storage abstraction (local vs cloud)
- ❌ Repository implementations
- ❌ HTTP routes and DTOs

#### What Is Wrongly Placed
- ⚠️ **None** - module is completely empty

#### Schema Evaluation
✅ **Sufficient** for artifact management:
- `CompileArtifact` - artifact metadata
- `storageKey` - reference to stored file
- `jobId` - link to compile job (optional, allows orphan artifacts)

**Question**: Should artifacts be immutable?
- Currently no update/delete operations defined
- Recommendation: Artifacts should be immutable (create-only, read-only)

---

### 6. **zotero** Module

#### What Exists
- ✅ Folder structure
- ✅ Empty Routes.ts and Dto.ts files
- ✅ Prisma schema with `ZoteroConnection` and `ZoteroSyncLog` models

#### Current Responsibility (Inferred from Schema)
The `ZoteroConnection` model owns:
- User's Zotero connection (userId, provider)
- OAuth tokens (accessToken, refreshToken)
- Library metadata (libraryId, libraryType)
- Connection timestamps (connectedAt, lastSyncedAt)

The `ZoteroSyncLog` model owns:
- Sync job metadata (connectionId, projectId)
- Sync type (full, incremental)
- Sync status (pending, running, success, failed)
- Sync results (itemsSynced, errorMessage)
- Sync timestamps (startedAt, finishedAt)

#### What Is Missing
- ❌ **All business logic**
- ❌ Connect Zotero account use case
- ❌ Disconnect Zotero account use case
- ❌ Sync bibliography use case
- ❌ Get Zotero items use case
- ❌ Generate .bib file use case
- ❌ Zotero API client (infra)
- ❌ OAuth flow handling
- ❌ Repository implementations
- ❌ HTTP routes and DTOs

#### What Is Wrongly Placed
- ⚠️ **None** - module is empty

#### Schema Evaluation
✅ **Well-designed** for Zotero integration:
- `ZoteroConnection` - user-level connection
- `ZoteroSyncLog` - audit trail of sync operations
- `ProjectSettings.zoteroConfig` - project-level Zotero configuration

**Question**: How is bibliography stored?
- Option 1: Generate .bib file in `File` table (kind = bib)
- Option 2: Store in `ProjectSettings.zoteroConfig` as JSON
- Recommendation: Option 1 (generate .bib file) for Typst compatibility

---

## Cross-Module Dependency Analysis

### Current Dependencies (from Schema)

```
User
  └─> Project (owner)
       ├─> ProjectSettings
       ├─> ProjectMember
       ├─> ProjectShareLink
       ├─> ProjectAdvisor
       ├─> File
       ├─> CompileJob
       │    └─> CompileArtifact
       ├─> CompileArtifact
       ├─> ProjectSnapshot
       └─> ProjectWordCountSnapshot

Template
  └─> TemplateVersion
       └─> Project (template origin)

ZoteroConnection
  └─> ZoteroSyncLog
```

### Required Cross-Module Interactions

#### 1. **projects → templates**
- **Use case**: Create project from template
- **Direction**: projects calls templates
- **Interface needed**: `ITemplateService.instantiateTemplate(templateVersionId, projectId)`
- **Data flow**: templates reads template files → projects creates project + files

#### 2. **projects → project-files**
- **Use case**: Initialize project files from template
- **Direction**: projects calls project-files
- **Interface needed**: `IFileService.createFiles(projectId, files[])`
- **Data flow**: projects orchestrates, project-files persists

#### 3. **compile → project-files**
- **Use case**: Read files for compilation
- **Direction**: compile calls project-files
- **Interface needed**: `IFileService.getFilesForCompilation(projectId, entryPath)`
- **Data flow**: compile reads, project-files provides content

#### 4. **compile → artifacts**
- **Use case**: Store compilation output
- **Direction**: compile calls artifacts
- **Interface needed**: `IArtifactService.storeArtifact(jobId, projectId, content, format)`
- **Data flow**: compile produces, artifacts persists

#### 5. **zotero → project-files**
- **Use case**: Generate/update .bib file
- **Direction**: zotero calls project-files
- **Interface needed**: `IFileService.updateFile(projectId, path, content)`
- **Data flow**: zotero generates .bib, project-files persists

#### 6. **projects → zotero** (optional)
- **Use case**: Check if project has Zotero configured
- **Direction**: projects queries zotero
- **Interface needed**: `IZoteroService.hasConnection(userId)`
- **Data flow**: projects checks, zotero responds

---

## Target State: Module Responsibilities

### **projects** Module

**Owns**:
- Project lifecycle (create, read, update, delete)
- Project metadata management
- Project ownership and permissions
- Collaboration (members, share links)
- Advisor assignment
- Project settings management
- Template-based project creation orchestration

**Does NOT own**:
- File content (delegates to project-files)
- Compilation logic (delegates to compile)
- Artifact storage (delegates to artifacts)
- Template file structure (delegates to templates)

**Public API** (`projects/index.ts`):
```typescript
export interface IProjectService {
  createProject(command: CreateProjectCommand): Promise<Result<ProjectDto>>;
  createProjectFromTemplate(command: CreateFromTemplateCommand): Promise<Result<ProjectDto>>;
  getProject(projectId: string, userId: string): Promise<Result<ProjectDto>>;
  listProjects(userId: string, filters: ProjectFilters): Promise<Result<ProjectListDto>>;
  updateProject(projectId: string, command: UpdateProjectCommand): Promise<Result<ProjectDto>>;
  deleteProject(projectId: string, userId: string): Promise<Result<void>>;
  
  // Collaboration
  addMember(projectId: string, command: AddMemberCommand): Promise<Result<void>>;
  removeMember(projectId: string, userId: string): Promise<Result<void>>;
  createShareLink(projectId: string, command: CreateShareLinkCommand): Promise<Result<ShareLinkDto>>;
  
  // Advisor
  assignAdvisor(projectId: string, teacherId: string, isPrimary: boolean): Promise<Result<void>>;
}
```

---

### **project-files** Module

**Owns**:
- File tree management within a project
- File CRUD operations
- File content storage (inline or object storage)
- File kind detection
- File metadata management

**Does NOT own**:
- Project-level permissions (delegates to projects)
- Compilation logic (provides files to compile)
- Template instantiation (receives files from templates)

**Public API** (`project-files/index.ts`):
```typescript
export interface IFileService {
  listFiles(projectId: string): Promise<Result<FileTreeDto>>;
  getFile(projectId: string, path: string): Promise<Result<FileDto>>;
  createFile(projectId: string, command: CreateFileCommand): Promise<Result<FileDto>>;
  updateFile(projectId: string, path: string, command: UpdateFileCommand): Promise<Result<FileDto>>;
  renameFile(projectId: string, oldPath: string, newPath: string): Promise<Result<void>>;
  deleteFile(projectId: string, path: string): Promise<Result<void>>;
  
  // For compile module
  getFilesForCompilation(projectId: string, entryPath: string): Promise<Result<CompilationFilesDto>>;
  
  // For templates module
  createFilesFromTemplate(projectId: string, files: TemplateFileDto[]): Promise<Result<void>>;
}
```

---

### **templates** Module

**Owns**:
- Template metadata management
- Template version management
- Template file structure definition
- Template instantiation logic
- Template file extraction

**Does NOT own**:
- Project creation (orchestrated by projects)
- File persistence (delegates to project-files)

**Public API** (`templates/index.ts`):
```typescript
export interface ITemplateService {
  listTemplates(filters: TemplateFilters): Promise<Result<TemplateListDto>>;
  getTemplate(templateId: string): Promise<Result<TemplateDto>>;
  getTemplateVersion(versionId: string): Promise<Result<TemplateVersionDto>>;
  
  // For projects module
  extractTemplateFiles(versionId: string): Promise<Result<TemplateFileDto[]>>;
  instantiateTemplate(versionId: string, projectId: string, variables?: Record<string, string>): Promise<Result<void>>;
}
```

---

### **compile** Module

**Owns**:
- Compile request orchestration
- Compile job lifecycle management
- Compile queue management
- Typst compiler invocation
- Diagnostics generation and parsing
- Compile mode handling (preview vs export)

**Does NOT own**:
- File content (reads from project-files)
- Artifact storage (delegates to artifacts)
- Project permissions (assumes caller verified)

**Public API** (`compile/index.ts`):
```typescript
export interface ICompileService {
  requestCompile(command: RequestCompileCommand): Promise<Result<CompileJobDto>>;
  getCompileJob(jobId: string): Promise<Result<CompileJobDto>>;
  getCompileStatus(jobId: string): Promise<Result<CompileStatusDto>>;
  getDiagnostics(jobId: string): Promise<Result<DiagnosticsDto>>;
  
  // For background processing
  processCompileQueue(): Promise<void>;
}
```

---

### **artifacts** Module

**Owns**:
- Artifact metadata management
- Artifact storage (local or cloud)
- Artifact retrieval
- Latest artifact lookup
- Artifact immutability enforcement

**Does NOT own**:
- Artifact generation (receives from compile)
- Project permissions (assumes caller verified)

**Public API** (`artifacts/index.ts`):
```typescript
export interface IArtifactService {
  storeArtifact(command: StoreArtifactCommand): Promise<Result<ArtifactDto>>;
  getArtifact(artifactId: string): Promise<Result<ArtifactDto>>;
  getLatestArtifact(projectId: string, mode?: CompileMode): Promise<Result<ArtifactDto | null>>;
  listArtifacts(projectId: string, filters: ArtifactFilters): Promise<Result<ArtifactListDto>>;
  downloadArtifact(artifactId: string): Promise<Result<ArtifactStreamDto>>;
}
```

---

### **zotero** Module

**Owns**:
- Zotero connection management
- OAuth flow handling
- Zotero API integration
- Bibliography sync orchestration
- .bib file generation
- Sync log management

**Does NOT own**:
- .bib file storage (delegates to project-files)
- Project permissions (assumes caller verified)

**Public API** (`zotero/index.ts`):
```typescript
export interface IZoteroService {
  connectZotero(userId: string, command: ConnectZoteroCommand): Promise<Result<ZoteroConnectionDto>>;
  disconnectZotero(userId: string): Promise<Result<void>>;
  getConnection(userId: string): Promise<Result<ZoteroConnectionDto | null>>;
  
  syncBibliography(projectId: string, userId: string): Promise<Result<SyncResultDto>>;
  getZoteroItems(userId: string, filters: ZoteroItemFilters): Promise<Result<ZoteroItemListDto>>;
}
```

---

## Schema Refinement Recommendations

### 1. **Remove Circular Dependency** (High Priority)

**Problem**: `CompileJob.latestArtifactId` ↔ `CompileArtifact.latestOfJob`

**Solution**: Remove `latestArtifactId` field from `CompileJob`

```prisma
model CompileJob {
  // Remove these lines:
  // latestArtifactId String?       @unique
  // latestArtifact   CompileArtifact? @relation("LatestArtifact", ...)
  
  // Keep this:
  artifacts       CompileArtifact[] @relation("JobArtifacts")
}

model CompileArtifact {
  // Remove this line:
  // latestOfJob CompileJob? @relation("LatestArtifact")
  
  // Keep this:
  job       CompileJob? @relation("JobArtifacts", ...)
}
```

**Query latest artifact**:
```typescript
const latestArtifact = await prisma.compileArtifact.findFirst({
  where: { projectId, job: { mode: "preview" } },
  orderBy: { createdAt: "desc" },
});
```

---

### 2. **Add FileStorageMode Enum** (Medium Priority)

**Problem**: Ambiguity between `textContent` and `storageKey`

**Solution**: Add explicit storage mode

```prisma
enum FileStorageMode {
  inline
  object_storage
}

model File {
  // Add this field:
  storageMode FileStorageMode @default(inline)
  
  // Existing fields:
  textContent  String?  @map("content") @db.Text
  storageKey   String?
}
```

**Policy**:
- If `storageMode = inline` → read from `textContent`
- If `storageMode = object_storage` → read from `storageKey`

---

### 3. **Add Index for Latest Artifact Query** (Low Priority)

**Problem**: Frequent query for latest artifact may be slow

**Solution**: Add composite index

```prisma
model CompileArtifact {
  @@index([projectId, createdAt(sort: Desc)])
}
```

---

### 4. **Clarify Template File Format** (Documentation)

**Problem**: `TemplateVersion.storageKey` format undefined

**Solution**: Define template file format specification

**Recommendation**:
- Store as ZIP archive containing:
  - `manifest.json` - template metadata, file list, variables
  - `files/` - template files (main.typ, images, etc.)
  - `preview.png` - template preview image (optional)

---

## Risk Assessment

### High Risks

1. **Cross-Module Circular Dependencies**
   - Risk: Modules calling each other in circular fashion
   - Mitigation: Use dependency inversion (ports/interfaces), enforce one-way dependencies
   - Rule: `projects` → `templates`, `project-files`, NOT the reverse

2. **Compile Job Queue Blocking**
   - Risk: Synchronous compile blocks HTTP requests
   - Mitigation: Use async job queue (background worker)
   - Recommendation: Implement compile as async from day 1

3. **File Storage Scalability**
   - Risk: Inline storage in DB doesn't scale
   - Mitigation: Use `storageMode` field, migrate to object storage later
   - Recommendation: Start with inline, add object storage when needed

### Medium Risks

4. **Template Instantiation Complexity**
   - Risk: Variable substitution, file transformation logic becomes complex
   - Mitigation: Keep templates simple (copy files as-is), defer variable substitution
   - Recommendation: Start with static templates, add variables later

5. **Zotero OAuth Token Expiration**
   - Risk: Tokens expire, sync fails silently
   - Mitigation: Implement token refresh logic, handle expiration gracefully
   - Recommendation: Add token expiration tracking

### Low Risks

6. **Artifact Storage Growth**
   - Risk: Artifacts accumulate, storage grows unbounded
   - Mitigation: Implement retention policy (keep last N artifacts per project)
   - Recommendation: Add cleanup job later

---

## Ambiguous Points Requiring Clarification

### 1. **Compile Job Processing Model**

**Question**: Synchronous or asynchronous?

**Options**:
- A. Synchronous: HTTP request waits for compile to finish
  - Pros: Simple, no background worker needed
  - Cons: Slow, blocks HTTP thread, timeout issues
- B. Asynchronous: HTTP request returns job ID, client polls for status
  - Pros: Scalable, non-blocking
  - Cons: More complex, requires background worker

**Recommendation**: **Option B (Async)** for production readiness

---

### 2. **Template Variable Substitution**

**Question**: Do templates support variables (e.g., `{{author}}`, `{{title}}`)?

**Options**:
- A. Static templates: Copy files as-is, no substitution
  - Pros: Simple, no parsing needed
  - Cons: Less flexible
- B. Variable templates: Replace placeholders with user-provided values
  - Pros: More flexible, better UX
  - Cons: More complex, requires parsing

**Recommendation**: **Start with Option A**, add Option B later if needed

---

### 3. **Zotero Bibliography Storage**

**Question**: Where to store generated .bib file?

**Options**:
- A. In `File` table as `kind = bib`
  - Pros: Consistent with other files, Typst can reference it
  - Cons: Regeneration overwrites file
- B. In `ProjectSettings.zoteroConfig` as JSON
  - Pros: Separate from user files
  - Cons: Typst can't reference it directly

**Recommendation**: **Option A** (store as File) for Typst compatibility

---

### 4. **Artifact Retention Policy**

**Question**: How long to keep artifacts?

**Options**:
- A. Keep all artifacts forever
  - Pros: Complete history
  - Cons: Storage grows unbounded
- B. Keep last N artifacts per project
  - Pros: Bounded storage
  - Cons: Lose history
- C. Keep artifacts for X days
  - Pros: Time-based retention
  - Cons: May lose recent artifacts

**Recommendation**: **Option B** (keep last 10 artifacts per project), implement cleanup job

---

## Implementation Order Recommendation

### Phase B - Implementation Plan

**Principle**: Build from bottom-up, minimize rework

#### **Stage 1: Foundation** (Week 1)
1. **project-files** module
   - Reason: No dependencies, needed by all other modules
   - Deliverables: File CRUD, file tree, storage abstraction
   - Estimated effort: 3-4 days

2. **projects** module (basic)
   - Reason: Core entity, needed by compile and artifacts
   - Deliverables: Project CRUD, ownership, settings (NO template integration yet)
   - Estimated effort: 3-4 days

#### **Stage 2: Compile Pipeline** (Week 2)
3. **artifacts** module
   - Reason: Needed by compile module
   - Deliverables: Artifact storage, retrieval, latest lookup
   - Estimated effort: 2-3 days

4. **compile** module
   - Reason: Depends on project-files and artifacts
   - Deliverables: Compile orchestration, job queue, Typst adapter
   - Estimated effort: 4-5 days

#### **Stage 3: Templates** (Week 3)
5. **templates** module
   - Reason: Depends on project-files
   - Deliverables: Template CRUD, template instantiation
   - Estimated effort: 3-4 days

6. **projects** module (template integration)
   - Reason: Depends on templates module
   - Deliverables: Create project from template
   - Estimated effort: 1-2 days

#### **Stage 4: Zotero** (Week 4)
7. **zotero** module
   - Reason: Depends on project-files, optional feature
   - Deliverables: Zotero connection, sync, .bib generation
   - Estimated effort: 4-5 days

---

## Conclusion

### Summary

✅ **Schema is well-designed** - only minor refinements needed  
✅ **Module boundaries are clear** - no major restructuring required  
✅ **Cross-module interfaces are definable** - use ports/public APIs  
⚠️ **All modules need implementation from scratch** - no existing code  
⚠️ **Circular dependency must be removed** - schema change required  

### Next Steps

1. **Get clarification** on ambiguous points (compile model, template variables, etc.)
2. **Approve schema refinements** (remove circular dependency, add FileStorageMode)
3. **Proceed to Phase B** - detailed implementation plan per module
4. **Start implementation** in recommended order (project-files → projects → artifacts → compile → templates → zotero)

### Estimated Total Effort

- **Stage 1 (Foundation)**: 6-8 days
- **Stage 2 (Compile Pipeline)**: 6-8 days
- **Stage 3 (Templates)**: 4-6 days
- **Stage 4 (Zotero)**: 4-5 days

**Total**: 20-27 days (4-5 weeks) for full implementation

---

**End of Phase A Analysis**
