# Structure Alignment Summary

## Issue Identified

The initial implementation used a **nested folder structure** that did NOT match the existing codebase conventions found in the `admin` and `auth` modules.

## Changes Made

### 1. Updated design.md

**Changed folder structure from:**
```
domain/
  entities/Project.ts
  ports/ProjectRepository.ts
  errors/ProjectErrors.ts
  policies/ProjectAuthPolicy.ts
application/
  use-cases/CreateProjectUseCase.ts
infra/
  repositories/PrismaProjectRepository.ts
delivery/
  http/
    Dto.ts
    Routes.ts
```

**To:**
```
domain/
  Project/
    Types.ts
    Ports.ts
    Errors.ts
    Policies.ts
application/
  Project/
    CreateProjectUseCase.ts
  Types.ts
infra/
  ProjectRepoPrisma.ts
delivery/
  http/
    Project/
      Dto.ts
      Routes.ts
```

**Key naming changes:**
- `ProjectRepository` → `ProjectRepo`
- `FileRepository` → `FileRepo`
- `PrismaProjectRepository` → `ProjectRepoPrisma`
- `PrismaFileRepository` → `FileRepoPrisma`
- `CreateProjectInput` → `CreateProjectData`
- `UpdateProjectInput` → `UpdateProjectData`
- Error classes → Error constants objects (matching `admin` module pattern)
- `Result<T, E>` → `Result<T>` with `{ success, data }` or `{ success, error: { code, message } }`

### 2. Updated tasks.md

- Reset all task checkboxes to `[ ]` (not started)
- Updated all file paths to match corrected structure
- Updated naming conventions throughout
- Added folder structure reference at the end
- Added note about following existing codebase conventions

### 3. Created STRUCTURE_ALIGNMENT.md

This document to track the alignment changes.

## Corrected Structure

### Projects Module

```
src/modules/projects/
  domain/
    Project/
      Types.ts          # Project, TemplateCategory, CreateProjectData, UpdateProjectData
      Ports.ts          # ProjectRepo interface
      Errors.ts         # ProjectErrors constants
      Policies.ts       # ProjectAuthPolicy (canRead, canWrite, canDelete)
  application/
    Project/
      CreateProjectUseCase.ts
      GetProjectUseCase.ts
      ListProjectsUseCase.ts
      UpdateProjectUseCase.ts
      DeleteProjectUseCase.ts
    Types.ts            # Result<T>, success(), failure()
  infra/
    ProjectRepoPrisma.ts
  delivery/
    http/
      Project/
        Dto.ts          # Zod schemas and OpenAPI annotations
        Routes.ts       # Fastify route registration
    ws/                 # (empty for now)
  Container.ts
  index.ts
```

### Project-Files Module

```
src/modules/project-files/
  domain/
    File/
      Types.ts          # File, FileKind, StorageMode, CreateFileData, etc.
      Ports.ts          # FileRepo interface
      Errors.ts         # FileErrors constants
      Policies.ts       # StoragePolicy (determineStorageMode)
  application/
    File/
      ListFilesUseCase.ts
      GetFileUseCase.ts
      CreateFileUseCase.ts
      UpdateFileUseCase.ts
      RenameFileUseCase.ts
      DeleteFileUseCase.ts
      GetFilesForCompilationUseCase.ts
      CreateFilesFromTemplateUseCase.ts
    Types.ts            # Result<T>, success(), failure()
  infra/
    FileRepoPrisma.ts
  delivery/
    http/
      File/
        Dto.ts          # Zod schemas and OpenAPI annotations
        Routes.ts       # Fastify route registration
    ws/                 # (empty for now)
  Container.ts
  index.ts
```

## Conventions Followed

Based on analysis of `admin` and `auth` modules:

1. **Domain Layer**: `domain/<Subdomain>/Types.ts`, `Ports.ts`, `Errors.ts`, `Policies.ts`
2. **Application Layer**: `application/<Subdomain>/*UseCase.ts`, `application/Types.ts`
3. **Infrastructure Layer**: `infra/*RepoPrisma.ts` (flat structure)
4. **Delivery Layer**: `delivery/http/<Subdomain>/Dto.ts`, `Routes.ts`
5. **Subdomain Naming**: `Project` for projects module, `File` for project-files module
6. **Repository Naming**: `ProjectRepo` interface, `ProjectRepoPrisma` implementation
7. **Error Pattern**: Constants objects with `{ code, message }` instead of Error classes
8. **Result Pattern**: `Result<T>` with `{ success: true, data }` or `{ success: false, error: { code, message } }`

## Next Steps

1. ✅ Spec files updated (design.md, tasks.md)
2. ⏭️ Refactor existing implementation to match corrected structure
3. ⏭️ Continue implementation with correct conventions

## Reference Modules

- **admin module**: Multi-subdomain example (Class, Department, Faculty, Major, etc.)
- **auth module**: Simple flat domain example (no subdomains)

The projects and project-files modules follow the admin module pattern with single subdomains (`Project` and `File`).
