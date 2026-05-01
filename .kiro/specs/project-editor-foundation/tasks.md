# Implementation Plan: Project Editor Foundation

## Overview

This implementation plan covers the foundational backend capabilities for two core modules:

1. **project-files module**: Complete file CRUD operations for managing Typst source files, bibliographies, images, data files, and other assets within projects
2. **projects module**: Basic project CRUD operations for creating, reading, updating, and deleting projects

**Stage 1 Constraints:**
- Inline storage only (no object storage infrastructure)
- Database cascade for project deletion cleanup
- No template instantiation, compile, artifacts, membership, sharing, or collaboration features

**Architecture:**
- Clean architecture (domain → application → infra → delivery)
- Result<T> pattern for error handling
- Container.ts for dependency wiring
- Zod validation and OpenAPI documentation
- **Follow existing codebase conventions** (see `admin` and `auth` modules)

**Folder Structure Conventions:**
- Domain: `domain/<Subdomain>/Types.ts`, `Ports.ts`, `Errors.ts`, `Policies.ts`
- Application (single-subdomain modules): `application/*UseCase.ts`, `application/Types.ts` (NO subdomain folder)
- Application (multi-subdomain modules): `application/<Subdomain>/*UseCase.ts`, `application/Types.ts`
- Infrastructure: `infra/*RepoPrisma.ts`
- Delivery: `delivery/http/<Subdomain>/Dto.ts`, `Routes.ts`
- Delivery: `delivery/ws/` (keep even if empty)

## Tasks

### Phase 1: Projects Module - Domain Layer

- [x] 1. Implement projects module domain layer
  - [x] 1.1 Create Project types
    - Create `src/modules/projects/domain/Project/Types.ts`
    - Define `Project` interface with id, title, category, ownerId, createdAt, updatedAt, lastEditedAt
    - Define `TemplateCategory` enum (thesis, report, proposal, paper, presentation, other)
    - Define `CreateProjectData` interface with title, category, ownerId
    - Define `UpdateProjectData` interface with projectId, title?, category?
    - _Requirements: 13_
  
  - [x] 1.2 Create ProjectRepo port interface
    - Create `src/modules/projects/domain/Project/Ports.ts`
    - Define `ProjectRepo` interface
    - Define methods: create, findById, listByOwnerId, update, delete
    - Return domain Project entities, not Prisma models
    - _Requirements: 14_
  
  - [x] 1.3 Create domain errors
    - Create `src/modules/projects/domain/Project/Errors.ts`
    - Define `ProjectErrors` constants object with code and message
    - Define `PROJECT_NOT_FOUND` error
    - Define `UNAUTHORIZED` error
    - _Requirements: 14, 20_
  
  - [x] 1.4 Create authorization policies
    - Create `src/modules/projects/domain/Project/Policies.ts`
    - Define `AuthContext` interface with userId and role
    - Implement `ProjectAuthPolicy` class
    - Implement `canRead` static method (owner or admin)
    - Implement `canWrite` static method (owner or admin)
    - Implement `canDelete` static method (owner or admin)
    - _Requirements: 20_

### Phase 2: Projects Module - Application Layer

- [x] 2. Implement projects module application layer
  - [x] 2.1 Create Result pattern
    - Create `src/modules/projects/application/Types.ts`
    - Define `Result<T>` type with success and failure cases
    - Define `success<T>` helper function
    - Define `failure` helper function
    - _Requirements: 26_
  
  - [x] 2.2 Implement CreateProjectUseCase
    - Create `src/modules/projects/application/CreateProjectUseCase.ts`
    - Define `CreateProjectCommand` interface
    - Validate title is non-empty
    - Enforce authorization (user can create projects)
    - Call repo.create
    - Return Result<Project>
    - _Requirements: 15_
  
  - [x] 2.3 Implement GetProjectUseCase
    - Create `src/modules/projects/application/GetProjectUseCase.ts`
    - Define `GetProjectCommand` interface
    - Call repo.findById
    - Enforce authorization using ProjectAuthPolicy.canRead
    - Return Result<Project>
    - _Requirements: 16, 20_
  
  - [x] 2.4 Implement ListProjectsUseCase
    - Create `src/modules/projects/application/ListProjectsUseCase.ts`
    - Define `ListProjectsCommand` interface
    - Call repo.listByOwnerId
    - Enforce authorization (user can only list their own projects)
    - Return projects ordered by updatedAt descending
    - Return Result<Project[]>
    - _Requirements: 17, 20_
  
  - [x] 2.5 Implement UpdateProjectUseCase
    - Create `src/modules/projects/application/UpdateProjectUseCase.ts`
    - Define `UpdateProjectCommand` interface
    - Call repo.findById
    - Enforce authorization using ProjectAuthPolicy.canWrite
    - Validate title remains non-empty if updated
    - Call repo.update
    - Return Result<Project>
    - _Requirements: 18, 20_
  
  - [x] 2.6 Implement DeleteProjectUseCase
    - Create `src/modules/projects/application/DeleteProjectUseCase.ts`
    - Define `DeleteProjectCommand` interface
    - Call repo.findById
    - Enforce authorization using ProjectAuthPolicy.canDelete
    - Call repo.delete (database cascade handles File records)
    - Return Result<void>
    - _Requirements: 19, 20_

### Phase 3: Projects Module - Infrastructure Layer

- [x] 3. Implement projects module infrastructure layer
  - [x] 3.1 Implement ProjectRepoPrisma
    - Create `src/modules/projects/infra/ProjectRepoPrisma.ts`
    - Implement all ProjectRepo port methods
    - Map Prisma Project models to domain Project entities
    - Handle Prisma errors and map to domain errors
    - Use Prisma transactions for operations requiring atomicity
    - _Requirements: 23_

### Phase 4: Projects Module - Delivery Layer

- [x] 4. Implement projects module delivery layer
  - [x] 4.1 Create DTOs and validation schemas
    - Create `src/modules/projects/delivery/http/Project/Dto.ts`
    - Define Zod schemas: CreateProjectRequestSchema, UpdateProjectRequestSchema, ProjectResponseSchema, ProjectListResponseSchema, ErrorResponseSchema
    - Add OpenAPI annotations using `@asteasolutions/zod-to-openapi`
    - _Requirements: 21, 30_
  
  - [x] 4.2 Create HTTP routes
    - Create `src/modules/projects/delivery/http/Project/Routes.ts`
    - Implement GET /api/v1/projects (list projects)
    - Implement POST /api/v1/projects (create project)
    - Implement GET /api/v1/projects/:projectId (get project)
    - Implement PUT /api/v1/projects/:projectId (update project)
    - Implement DELETE /api/v1/projects/:projectId (delete project)
    - Use `app.auth.verify` preHandler for authentication
    - Validate requests with Zod schemas
    - Map domain errors to HTTP status codes (404, 403, 400)
    - Unwrap Result types and format responses
    - _Requirements: 21, 30_

### Phase 5: Projects Module - Wiring

- [x] 5. Wire projects module dependencies
  - [x] 5.1 Create Container
    - Create `src/modules/projects/Container.ts`
    - Instantiate ProjectRepoPrisma
    - Instantiate all use cases with repository dependency
    - Provide getter methods for use cases
    - _Requirements: 24_
  
  - [x] 5.2 Create module public API
    - Create `src/modules/projects/index.ts`
    - Export use cases, domain types, and errors
    - Do NOT export infra implementations or delivery code
    - _Requirements: 25_

### Phase 6: Project-Files Module - Domain Layer

- [x] 6. Implement project-files module domain layer
  - [x] 6.1 Create File types
    - Create `src/modules/project-files/domain/ProjectFile/Types.ts`
    - Define `FileKind` enum (typst, bib, image, data, other)
    - Define `StorageMode` enum (inline, object_storage)
    - Define `File` interface with all fields
    - Define `CreateFileData`, `UpdateFileData`, `RenameFileData` interfaces
    - Enforce path uniqueness within projectId (documented constraint)
    - _Requirements: 1_
  
  - [x] 6.2 Create FileRepo port interface
    - Create `src/modules/project-files/domain/ProjectFile/Ports.ts`
    - Define `FileRepo` interface
    - Define methods: create, findById, findByProjectIdAndPath, listByProjectId, update, rename, delete, findForCompilation
    - Return domain File entities, not Prisma models
    - _Requirements: 2_
  
  - [x] 6.3 Create domain errors
    - Create `src/modules/project-files/domain/ProjectFile/Errors.ts`
    - Define `FileErrors` constants object with code and message
    - Define `FILE_NOT_FOUND` error
    - Define `FILE_ALREADY_EXISTS` error
    - Define `INVALID_FILE_PATH` error
    - _Requirements: 2_
  
  - [x] 6.4 Create storage policy
    - Create `src/modules/project-files/domain/ProjectFile/Policies.ts`
    - Implement `StoragePolicy` class
    - Implement `determineStorageMode` static method
    - Stage 1: Always return StorageMode.Inline
    - Add commented-out future logic for object storage threshold
    - _Requirements: 3_

### Phase 7: Project-Files Module - Application Layer

- [x] 7. Implement project-files module application layer
  - [x] 7.1 Create Result pattern
    - Create `src/modules/project-files/application/Types.ts`
    - Define `Result<T>` type with success and failure cases
    - Define `success<T>` and `failure` helper functions
    - _Requirements: 26_
  
  - [x] 7.2 Implement ListFilesUseCase
    - Create `src/modules/project-files/application/ListFilesUseCase.ts`
    - Define `ListFilesCommand` interface
    - Verify project exists via ProjectRepo
    - Enforce authorization
    - Call fileRepo.listByProjectId
    - Return files ordered by path alphabetically
    - Exclude textContent and storageKey from response
    - Return Result<FileMetadata[]>
    - _Requirements: 4_
  
  - [x] 7.3 Implement GetFileUseCase
    - Create `src/modules/project-files/application/GetFileUseCase.ts`
    - Define `GetFileCommand` interface
    - Call fileRepo.findByProjectIdAndPath
    - Enforce authorization
    - Return complete file entity including content
    - Return Result<File>
    - _Requirements: 5_
  
  - [x] 7.4 Implement CreateFileUseCase
    - Create `src/modules/project-files/application/CreateFileUseCase.ts`
    - Define `CreateFileCommand` interface
    - Verify project exists
    - Enforce authorization
    - Validate path format (reject ../, ./, absolute paths, empty paths)
    - Check if file already exists at path
    - Compute sizeBytes and sha256 hash using Node.js crypto module
    - Apply StoragePolicy.determineStorageMode
    - Set lastEditedAt to current timestamp
    - Call fileRepo.create
    - Return Result<File>
    - _Requirements: 6_
  
  - [x] 7.5 Implement UpdateFileUseCase
    - Create `src/modules/project-files/application/UpdateFileUseCase.ts`
    - Define `UpdateFileCommand` interface
    - Call fileRepo.findByProjectIdAndPath
    - Enforce authorization
    - Recompute sizeBytes and sha256 hash
    - Update lastEditedAt to current timestamp
    - Preserve storageMode (Stage 1: always inline)
    - Call fileRepo.update
    - Return Result<File>
    - _Requirements: 7_
  
  - [x] 7.6 Implement RenameFileUseCase
    - Create `src/modules/project-files/application/RenameFileUseCase.ts`
    - Define `RenameFileCommand` interface
    - Verify file exists at oldPath
    - Enforce authorization
    - Check if file already exists at newPath
    - Validate newPath format
    - Call fileRepo.rename
    - Preserve all content and metadata
    - Update updatedAt timestamp
    - Return Result<File>
    - _Requirements: 8_
  
  - [x] 7.7 Implement DeleteFileUseCase
    - Create `src/modules/project-files/application/DeleteFileUseCase.ts`
    - Define `DeleteFileCommand` interface
    - Call fileRepo.findByProjectIdAndPath
    - Enforce authorization
    - Call fileRepo.delete
    - Stage 1: Only delete database record (inline storage)
    - Return Result<void>
    - _Requirements: 9_
  
  - [x] 7.8 Implement GetFilesForCompilationUseCase
    - Create `src/modules/project-files/application/GetFilesForCompilationUseCase.ts`
    - Define `GetFilesForCompilationCommand` interface
    - Enforce authorization
    - Call fileRepo.findForCompilation
    - Return files with kind: typst, bib, image, or data
    - Include full content for inline files
    - Return Result<File[]>
    - _Requirements: 10_
  
  - [x] 7.9 Implement CreateFilesFromTemplateUseCase
    - Create `src/modules/project-files/application/CreateFilesFromTemplateUseCase.ts`
    - Define `CreateFilesFromTemplateCommand` interface with projectId and template file list
    - Apply storage policy to each file
    - Preserve template file paths and kinds
    - Set createdAt and updatedAt for all files
    - Return error indicating which file failed if any creation fails
    - Return Result<File[]>
    - _Requirements: 11_

### Phase 8: Project-Files Module - Infrastructure Layer

- [x] 8. Implement project-files module infrastructure layer
  - [x] 8.1 Implement FileRepoPrisma
    - Create `src/modules/project-files/infra/FileRepoPrisma.ts`
    - Implement all FileRepo port methods
    - Map domain File entities to Prisma File models and vice versa
    - Handle Prisma errors and map to domain errors (P2002 → FILE_ALREADY_EXISTS, P2025 → FILE_NOT_FOUND)
    - Use Prisma transactions for operations requiring atomicity
    - Implement findForCompilation to filter by kind (typst, bib, image, data)
    - _Requirements: 22_

### Phase 9: Project-Files Module - Delivery Layer

- [x] 9. Implement project-files module delivery layer
  - [x] 9.1 Create DTOs and validation schemas
    - Create `src/modules/project-files/delivery/http/ProjectFile/Dto.ts`
    - Define Zod schemas: FileKindSchema, CreateFileRequestSchema, UpdateFileRequestSchema, RenameFileRequestSchema, FileMetadataSchema, FileResponseSchema, FileListResponseSchema, ErrorResponseSchema
    - Add OpenAPI annotations with examples and descriptions
    - _Requirements: 12, 30_
  
  - [x] 9.2 Create HTTP routes
    - Create `src/modules/project-files/delivery/http/ProjectFile/Routes.ts`
    - Implement GET /api/v1/projects/:projectId/files (list files)
    - Implement GET /api/v1/projects/:projectId/files/*path (get file)
    - Implement POST /api/v1/projects/:projectId/files (create file)
    - Implement PUT /api/v1/projects/:projectId/files/*path (update file)
    - Implement PATCH /api/v1/projects/:projectId/files/*path/rename (rename file)
    - Implement DELETE /api/v1/projects/:projectId/files/*path (delete file)
    - Use `app.auth.verify` preHandler for authentication
    - Validate requests with Zod schemas
    - Map domain errors to HTTP status codes (404, 409, 400, 403)
    - Unwrap Result types and format responses
    - _Requirements: 12, 30_

### Phase 10: Project-Files Module - Wiring

- [x] 10. Wire project-files module dependencies
  - [x] 10.1 Create Container
    - Create `src/modules/project-files/Container.ts`
    - Accept PrismaClient and ProjectRepo as constructor parameters
    - Instantiate FileRepoPrisma
    - Instantiate all use cases with repository dependencies
    - Provide getter methods for use cases
    - _Requirements: 24_
  
  - [x] 10.2 Create module public API
    - Create `src/modules/project-files/index.ts`
    - Export use cases, domain types, and errors
    - Do NOT export infra implementations or delivery code
    - _Requirements: 25_

### Phase 11: App-Level Integration

- [x] 11. Integrate modules into main application
  - [x] 11.1 Register projects module routes
    - Update `src/app.ts` or equivalent route assembly file
    - Initialize ProjectsContainer with Prisma client
    - Register projects module routes with container
    - _Requirements: 21_
  
  - [x] 11.2 Register project-files module routes
    - Update `src/app.ts` or equivalent route assembly file
    - Initialize ProjectFilesContainer with Prisma client and ProjectRepo
    - Register project-files module routes with container
    - _Requirements: 12_
  
  - [x] 11.3 Verify Swagger documentation
    - Start the application
    - Navigate to /docs endpoint
    - Verify all projects and project-files endpoints are documented
    - Verify request/response schemas are displayed correctly
    - Verify security (bearerAuth) is shown for protected endpoints
    - _Requirements: 30_

### Phase 12: Build and Verification

- [x] 12. Build verification and final checks
  - [x] 12.1 Run TypeScript build
    - Execute `npm run build`
    - Verify no TypeScript errors
    - Verify strict mode compliance
    - Verify all imports use .js extensions
    - Verify domain layer has no framework imports
    - Verify application layer has no Prisma or Fastify imports
    - _Requirements: 27_
  
  - [x] 12.2 Run smoke tests
    - Execute `npm run test:api:stage1`
    - Verify all tests pass (53/53 passing)
    - _Requirements: 27_

### Phase 13: Optional Testing Tasks

- [x] 13. Unit tests for projects module use cases
  - [x] 13.1 Write unit tests for CreateProjectUseCase
    - Test successful creation
    - Test authorization enforcement
    - Test validation (empty title)
    - Use mock ProjectRepo
    - _Requirements: 28_
  
  - [x] 13.2 Write unit tests for GetProjectUseCase
    - Test successful retrieval
    - Test PROJECT_NOT_FOUND error
    - Test UNAUTHORIZED error
    - Use mock ProjectRepo
    - _Requirements: 28_
  
  - [x] 13.3 Write unit tests for ListProjectsUseCase
    - Test successful list
    - Test empty list
    - Test authorization enforcement
    - Use mock ProjectRepo
    - _Requirements: 28_
  
  - [x] 13.4 Write unit tests for UpdateProjectUseCase
    - Test successful update
    - Test PROJECT_NOT_FOUND error
    - Test UNAUTHORIZED error
    - Test validation (empty title)
    - Use mock ProjectRepo
    - _Requirements: 28_
  
  - [x] 13.5 Write unit tests for DeleteProjectUseCase
    - Test successful deletion
    - Test PROJECT_NOT_FOUND error
    - Test UNAUTHORIZED error
    - Use mock ProjectRepo
    - _Requirements: 28_

- [x]* 14. Unit tests for project-files module use cases
  - [x]* 14.1 Write unit tests for CreateFileUseCase
    - Test successful creation
    - Test FILE_ALREADY_EXISTS error
    - Test PROJECT_NOT_FOUND error
    - Test INVALID_FILE_PATH error (../, ./, absolute paths)
    - Test authorization enforcement
    - Test storage policy application
    - Test hash computation
    - Use mock FileRepo and ProjectRepo
    - _Requirements: 28_
  
  - [ ]* 14.2 Write unit tests for GetFileUseCase
    - Test successful retrieval
    - Test FILE_NOT_FOUND error
    - Test UNAUTHORIZED error
    - Use mock FileRepo
    - _Requirements: 28_
  
  - [ ]* 14.3 Write unit tests for ListFilesUseCase
    - Test successful list
    - Test empty list
    - Test PROJECT_NOT_FOUND error
    - Test authorization enforcement
    - Verify textContent and storageKey excluded
    - Use mock FileRepo and ProjectRepo
    - _Requirements: 28_
  
  - [ ]* 14.4 Write unit tests for UpdateFileUseCase
    - Test successful update
    - Test FILE_NOT_FOUND error
    - Test UNAUTHORIZED error
    - Test hash recomputation
    - Test lastEditedAt update
    - Use mock FileRepo
    - _Requirements: 28_
  
  - [ ]* 14.5 Write unit tests for RenameFileUseCase
    - Test successful rename
    - Test FILE_NOT_FOUND error (oldPath)
    - Test FILE_ALREADY_EXISTS error (newPath)
    - Test INVALID_FILE_PATH error
    - Test UNAUTHORIZED error
    - Use mock FileRepo
    - _Requirements: 28_
  
  - [ ]* 14.6 Write unit tests for DeleteFileUseCase
    - Test successful deletion
    - Test FILE_NOT_FOUND error
    - Test UNAUTHORIZED error
    - Use mock FileRepo
    - _Requirements: 28_
  
  - [ ]* 14.7 Write unit tests for GetFilesForCompilationUseCase
    - Test successful retrieval
    - Test filtering by kind (typst, bib, image, data)
    - Test PROJECT_NOT_FOUND error
    - Test UNAUTHORIZED error
    - Use mock FileRepo
    - _Requirements: 28_
  
  - [ ]* 14.8 Write unit tests for CreateFilesFromTemplateUseCase
    - Test successful batch creation
    - Test partial failure handling
    - Test storage policy application
    - Use mock FileRepo
    - _Requirements: 28_

- [ ]* 15. Integration tests for projects module HTTP routes
  - [ ]* 15.1 Write integration tests for POST /api/v1/projects
    - Test valid request returns 201
    - Test invalid request (empty title) returns 400
    - Test unauthorized request returns 401
    - Use test database
    - _Requirements: 29_
  
  - [ ]* 15.2 Write integration tests for GET /api/v1/projects/:projectId
    - Test valid request returns 200
    - Test non-existent project returns 404
    - Test unauthorized access returns 403
    - Use test database
    - _Requirements: 29_
  
  - [ ]* 15.3 Write integration tests for GET /api/v1/projects
    - Test returns user's projects
    - Test returns empty list for new user
    - Test ordering by updatedAt descending
    - Use test database
    - _Requirements: 29_
  
  - [ ]* 15.4 Write integration tests for PUT /api/v1/projects/:projectId
    - Test valid update returns 200
    - Test non-existent project returns 404
    - Test unauthorized access returns 403
    - Test invalid update (empty title) returns 400
    - Use test database
    - _Requirements: 29_
  
  - [ ]* 15.5 Write integration tests for DELETE /api/v1/projects/:projectId
    - Test successful deletion returns 204
    - Test non-existent project returns 404
    - Test unauthorized access returns 403
    - Test cascade deletion of files
    - Use test database
    - _Requirements: 29_

- [ ]* 16. Integration tests for project-files module HTTP routes
  - [ ]* 16.1 Write integration tests for POST /api/v1/projects/:projectId/files
    - Test valid request returns 201
    - Test duplicate file returns 409
    - Test invalid path returns 400
    - Test non-existent project returns 404
    - Test unauthorized request returns 403
    - Use test database
    - _Requirements: 29_
  
  - [ ]* 16.2 Write integration tests for GET /api/v1/projects/:projectId/files/*path
    - Test valid request returns 200 with content
    - Test non-existent file returns 404
    - Test unauthorized access returns 403
    - Use test database
    - _Requirements: 29_
  
  - [ ]* 16.3 Write integration tests for GET /api/v1/projects/:projectId/files
    - Test returns file list
    - Test returns empty list for new project
    - Test ordering by path alphabetically
    - Test textContent and storageKey excluded
    - Test non-existent project returns 404
    - Use test database
    - _Requirements: 29_
  
  - [ ]* 16.4 Write integration tests for PUT /api/v1/projects/:projectId/files/*path
    - Test valid update returns 200
    - Test non-existent file returns 404
    - Test unauthorized access returns 403
    - Use test database
    - _Requirements: 29_
  
  - [ ]* 16.5 Write integration tests for PATCH /api/v1/projects/:projectId/files:rename?path=...
    - Test valid rename returns 200
    - Test non-existent file returns 404
    - Test duplicate newPath returns 409
    - Test invalid newPath returns 400
    - Test unauthorized access returns 403
    - Use test database
    - _Requirements: 29_
  
  - [ ]* 16.6 Write integration tests for DELETE /api/v1/projects/:projectId/files/*path
    - Test successful deletion returns 204
    - Test non-existent file returns 404
    - Test unauthorized access returns 403
    - Use test database
    - _Requirements: 29_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Stage 1 focuses on inline storage only; object storage support is future work
- Database cascade handles File record removal when projects are deleted
- All use cases use Result<T> pattern for explicit error handling
- Authorization is enforced at the use case level using domain policies
- HTTP routes map domain errors to appropriate status codes
- Swagger documentation is generated from Zod schemas
- **IMPORTANT**: Follow existing codebase conventions from `admin` and `auth` modules

## Folder Structure Reference

### Projects Module (Single-Subdomain)
```
src/modules/projects/
  domain/
    Project/
      Types.ts
      Ports.ts
      Errors.ts
      Policies.ts
  application/
    Types.ts
    CreateProjectUseCase.ts
    GetProjectUseCase.ts
    ListProjectsUseCase.ts
    UpdateProjectUseCase.ts
    DeleteProjectUseCase.ts
  infra/
    ProjectRepoPrisma.ts
  delivery/
    http/
      Project/
        Dto.ts
        Routes.ts
    ws/
  Container.ts
  index.ts
```

### Project-Files Module (Single-Subdomain)
```
src/modules/project-files/
  domain/
    ProjectFile/
      Types.ts
      Ports.ts
      Errors.ts
      Policies.ts
  application/
    Types.ts
    CreateFileUseCase.ts
    GetFileUseCase.ts
    ListFilesUseCase.ts
    UpdateFileUseCase.ts
    RenameFileUseCase.ts
    DeleteFileUseCase.ts
    GetFilesForCompilationUseCase.ts
    CreateFilesFromTemplateUseCase.ts
  infra/
    FileRepoPrisma.ts
  delivery/
    http/
      ProjectFile/
        Dto.ts
        Routes.ts
    ws/
  Container.ts
  index.ts
```

**Note**: Both modules follow the single-subdomain pattern where use cases are placed directly under `application/` without an additional subdomain folder. This differs from multi-subdomain modules like `admin` which keep subdomain folders in `application/`.
