# Project/Editor Modules - Analysis Summary

**Date**: April 18, 2026  
**Phase**: A - Analysis Complete  
**Status**: ✅ READY FOR REVIEW

---

## Quick Summary

All six project/editor modules are **empty scaffolds** awaiting implementation. The Prisma schema is **well-designed** and supports the hybrid Typst editor architecture with only **minor refinements** needed.

---

## Key Findings

### ✅ What's Good

1. **Schema is solid**
   - Project, File, CompileJob, CompileArtifact, Template models are well-designed
   - Supports hybrid architecture (client preview + server compile)
   - Collaboration features (members, share links, advisors) are modeled
   - Zotero integration is modeled

2. **Module boundaries are clear**
   - Each module has a distinct responsibility
   - No major restructuring needed
   - Clean separation of concerns

3. **Architecture is sound**
   - Follows clean architecture principles
   - Modular monolith structure is appropriate
   - Cross-module dependencies are manageable

### ⚠️ What Needs Attention

1. **Circular dependency in schema**
   - `CompileJob.latestArtifactId` ↔ `CompileArtifact.latestOfJob`
   - **Fix**: Remove `latestArtifactId`, query latest artifact instead

2. **File storage ambiguity**
   - When to use `textContent` vs `storageKey`?
   - **Fix**: Add `FileStorageMode` enum (inline vs object_storage)

3. **All modules need implementation**
   - Zero business logic exists
   - Estimated 4-5 weeks for full implementation

---

## Module Responsibilities (Final)

| Module | Owns | Does NOT Own |
|--------|------|--------------|
| **projects** | Project CRUD, ownership, collaboration, settings, template orchestration | File content, compilation, artifacts |
| **project-files** | File CRUD, file tree, storage abstraction | Project permissions, compilation |
| **templates** | Template metadata, versioning, instantiation logic | Project creation, file persistence |
| **compile** | Compile orchestration, job queue, Typst execution, diagnostics | File content, artifact storage |
| **artifacts** | Artifact storage, retrieval, latest lookup | Artifact generation, project permissions |
| **zotero** | Zotero connection, sync, .bib generation | .bib file storage, project permissions |

---

## Cross-Module Interactions

```
projects → templates      (instantiate template)
projects → project-files  (initialize files)
compile  → project-files  (read files for compilation)
compile  → artifacts      (store compilation output)
templates → project-files (create template files)
zotero   → project-files  (update .bib file)
```

**Rule**: One-way dependencies only, no circular dependencies.

---

## Schema Changes Required

### 1. Remove Circular Dependency (REQUIRED)

```prisma
model CompileJob {
  // REMOVE:
  // latestArtifactId String?       @unique
  // latestArtifact   CompileArtifact? @relation("LatestArtifact", ...)
  
  // KEEP:
  artifacts       CompileArtifact[] @relation("JobArtifacts")
}

model CompileArtifact {
  // REMOVE:
  // latestOfJob CompileJob? @relation("LatestArtifact")
  
  // KEEP:
  job       CompileJob? @relation("JobArtifacts", ...)
}
```

**Query latest artifact**:
```typescript
const latest = await prisma.compileArtifact.findFirst({
  where: { projectId },
  orderBy: { createdAt: "desc" },
});
```

### 2. Add FileStorageMode Enum (RECOMMENDED)

```prisma
enum FileStorageMode {
  inline
  object_storage
}

model File {
  storageMode FileStorageMode @default(inline)
  textContent  String?  @map("content") @db.Text
  storageKey   String?
}
```

---

## Ambiguous Points Requiring Clarification

### 1. Compile Job Processing Model

**Question**: Synchronous or asynchronous?

- **Option A**: Synchronous (HTTP waits for compile)
  - Simple, but slow and blocking
- **Option B**: Asynchronous (return job ID, poll for status)
  - Scalable, but requires background worker

**Recommendation**: **Async** for production readiness

### 2. Template Variable Substitution

**Question**: Do templates support variables (e.g., `{{author}}`)?

- **Option A**: Static templates (copy as-is)
  - Simple, no parsing
- **Option B**: Variable templates (replace placeholders)
  - Flexible, but more complex

**Recommendation**: **Start with static**, add variables later

### 3. Zotero Bibliography Storage

**Question**: Where to store generated .bib file?

- **Option A**: In `File` table as `kind = bib`
  - Typst can reference it directly
- **Option B**: In `ProjectSettings.zoteroConfig` as JSON
  - Separate from user files

**Recommendation**: **Option A** for Typst compatibility

### 4. Artifact Retention Policy

**Question**: How long to keep artifacts?

- **Option A**: Keep all forever (unbounded storage)
- **Option B**: Keep last N artifacts per project
- **Option C**: Keep artifacts for X days

**Recommendation**: **Keep last 10 artifacts**, implement cleanup job

---

## Implementation Order

### Stage 1: Foundation (Week 1)
1. **project-files** - File CRUD, no dependencies
2. **projects** (basic) - Project CRUD, no template integration yet

### Stage 2: Compile Pipeline (Week 2)
3. **artifacts** - Artifact storage
4. **compile** - Compile orchestration, Typst adapter

### Stage 3: Templates (Week 3)
5. **templates** - Template CRUD, instantiation
6. **projects** (template integration) - Create from template

### Stage 4: Zotero (Week 4)
7. **zotero** - Zotero connection, sync, .bib generation

**Total Estimated Effort**: 20-27 days (4-5 weeks)

---

## Risks

### High Risks
1. **Cross-module circular dependencies** - Mitigate with ports/interfaces
2. **Compile job queue blocking** - Mitigate with async processing
3. **File storage scalability** - Mitigate with storage mode field

### Medium Risks
4. **Template instantiation complexity** - Start simple, add features later
5. **Zotero OAuth token expiration** - Implement token refresh

### Low Risks
6. **Artifact storage growth** - Implement retention policy later

---

## Next Steps

### 1. Review & Approve
- [ ] Review analysis document
- [ ] Approve schema changes
- [ ] Clarify ambiguous points
- [ ] Approve implementation order

### 2. Schema Migration
- [ ] Remove circular dependency
- [ ] Add FileStorageMode enum
- [ ] Generate migration
- [ ] Apply migration

### 3. Start Implementation
- [ ] Begin with project-files module
- [ ] Follow recommended implementation order
- [ ] Use provided public API interfaces

---

## Documentation

- **Full Analysis**: `docs/PROJECT_MODULES_ANALYSIS.md`
- **Architecture Diagrams**: `docs/PROJECT_MODULES_ARCHITECTURE.md`
- **This Summary**: `docs/PROJECT_MODULES_SUMMARY.md`

---

## Conclusion

✅ **Analysis Complete**  
✅ **Schema is solid** (minor refinements needed)  
✅ **Module boundaries are clear**  
✅ **Implementation plan is ready**  
⚠️ **Awaiting clarification** on ambiguous points  
⚠️ **Awaiting approval** to proceed with implementation  

**Estimated Timeline**: 4-5 weeks for full implementation

---

**End of Phase A - Analysis**
