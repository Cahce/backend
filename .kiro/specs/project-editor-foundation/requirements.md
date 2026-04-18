# Requirements Document: Project Editor Foundation

## Introduction

This specification defines the foundational backend capabilities for the project editor in a collaborative Typst document editing platform. It covers two core modules:

1. **project-files module**: Complete file CRUD operations for managing Typst source files, bibliographies, images, data files, and other assets within projects
2. **projects module**: Basic project CRUD operations for creating, reading, updating, and deleting projects (excluding templates, compile, artifacts, membership, sharing, and collaboration features)

This foundation establishes the authoritative backend persistence layer that the hybrid editor depends on, ensuring the backend remains the source of truth for project structure and file content.

## Glossary

- **Project_Files_Module**: The backend module responsible for file lifecycle operations within projects
- **Projects_Module**: The backend module responsible for basic project lifecycle operations
- **File_Entity**: A domain entity representing a file within a project (Typst source, bibliography, image, data, or other)
- **Project_Entity**: A domain entity representing a project container
- **File_Repository**: The domain port for file persistence operations
- **Project_Repository**: The domain port for project persistence operations
- **Storage_Mode**: An enumeration indicating whether file content is stored inline (textContent) or in object storage (storageKey)
- **File_Kind**: An enumeration categorizing files as typst, bib, image, data, or other
- **API_Client**: The frontend or external system consuming the HTTP API
- **Compilation_System**: The downstream compile module that reads files for Typst compilation
- **Authorization_System**: The existing auth module that verifies user identity and permissions

## Requirements

### Requirement 1: File Entity Domain Model

**User Story:** As a backend developer, I want a well-defined File entity in the domain layer, so that file operations follow clean architecture principles and remain independent of infrastructure concerns.

#### Acceptance Criteria

1. THE File_Entity SHALL contain id, projectId, path, kind, textContent, storageKey, mimeType, sizeBytes, sha256, lastEditedAt, createdAt, and updatedAt fields
2. THE File_Entity SHALL enforce that path is unique within a projectId
3. THE File_Entity SHALL support FileKind enumeration with values: typst, bib, image, data, other
4. THE File_Entity SHALL support StorageMode enumeration with values: inline, object_storage
5. WHEN storageMode is inline, THE File_Entity SHALL use textContent for file content
6. WHEN storageMode is object_storage, THE File_Entity SHALL use storageKey for file reference
7. THE File_Entity SHALL NOT import Prisma, Fastify, Zod, or any framework dependency

### Requirement 2: File Repository Port

**User Story:** As a backend developer, I want a repository port interface for file operations, so that the domain layer remains decoupled from Prisma implementation details.

#### Acceptance Criteria

1. THE File_Repository SHALL define methods: create, findById, findByProjectIdAndPath, listByProjectId, update, delete, findForCompilation
2. THE File_Repository SHALL return domain File_Entity instances, not Prisma models
3. THE File_Repository SHALL define error cases: FileNotFound, FileAlreadyExists, InvalidFilePath
4. THE File_Repository SHALL NOT expose Prisma-specific types in its interface

### Requirement 3: File Storage Policy

**User Story:** As a backend developer, I want automatic storage mode selection based on file size and kind, so that small text files are stored inline and large binary files use object storage efficiently.

#### Acceptance Criteria

1. WHEN a file is created with size < 1MB AND kind is typst OR bib, THE Project_Files_Module SHALL set storageMode to inline
2. WHEN a file is created with size >= 1MB OR kind is image OR data, THE Project_Files_Module SHALL set storageMode to object_storage
3. WHEN storageMode is inline, THE Project_Files_Module SHALL store content in textContent field
4. WHEN storageMode is object_storage, THE Project_Files_Module SHALL store reference in storageKey field
5. THE Project_Files_Module SHALL validate that exactly one of textContent or storageKey is populated based on storageMode

### Requirement 4: List Files Use Case

**User Story:** As an API client, I want to list all files in a project, so that I can display the project file tree in the editor UI.

#### Acceptance Criteria

1. WHEN a valid projectId is provided, THE Project_Files_Module SHALL return all files belonging to that project
2. THE Project_Files_Module SHALL return files ordered by path alphabetically
3. THE Project_Files_Module SHALL include file metadata: id, path, kind, mimeType, sizeBytes, lastEditedAt, createdAt, updatedAt
4. THE Project_Files_Module SHALL NOT include textContent or storageKey in list responses
5. WHEN the project does not exist, THE Project_Files_Module SHALL return a ProjectNotFound error
6. WHEN the project exists but has no files, THE Project_Files_Module SHALL return an empty list
7. THE Project_Files_Module SHALL enforce authorization before returning file list

### Requirement 5: Get File Use Case

**User Story:** As an API client, I want to retrieve a specific file by path, so that I can load file content into the editor.

#### Acceptance Criteria

1. WHEN a valid projectId and path are provided, THE Project_Files_Module SHALL return the complete file entity including content
2. WHEN storageMode is inline, THE Project_Files_Module SHALL return textContent
3. WHEN storageMode is object_storage, THE Project_Files_Module SHALL return storageKey for client-side retrieval
4. WHEN the file does not exist, THE Project_Files_Module SHALL return FileNotFound error
5. THE Project_Files_Module SHALL enforce authorization before returning file content

### Requirement 6: Create File Use Case

**User Story:** As an API client, I want to create a new file in a project, so that I can add source files, images, or bibliographies to the project.

#### Acceptance Criteria

1. WHEN valid projectId, path, kind, and content are provided, THE Project_Files_Module SHALL create a new file
2. THE Project_Files_Module SHALL apply storage policy to determine storageMode
3. WHEN a file already exists at the same path, THE Project_Files_Module SHALL return FileAlreadyExists error
4. THE Project_Files_Module SHALL validate path format and reject invalid paths
5. THE Project_Files_Module SHALL compute and store sizeBytes and sha256 hash
6. THE Project_Files_Module SHALL set lastEditedAt to current timestamp
7. THE Project_Files_Module SHALL enforce authorization before creating file

### Requirement 7: Update File Use Case

**User Story:** As an API client, I want to update an existing file's content, so that I can save editor changes to the backend.

#### Acceptance Criteria

1. WHEN valid projectId, path, and new content are provided, THE Project_Files_Module SHALL update the file content
2. THE Project_Files_Module SHALL recompute sizeBytes and sha256 hash
3. THE Project_Files_Module SHALL update lastEditedAt to current timestamp
4. THE Project_Files_Module SHALL preserve storageMode unless size threshold is crossed
5. WHEN the file does not exist, THE Project_Files_Module SHALL return FileNotFound error
6. THE Project_Files_Module SHALL enforce authorization before updating file

### Requirement 8: Rename File Use Case

**User Story:** As an API client, I want to rename a file within a project, so that I can reorganize project structure without losing content.

#### Acceptance Criteria

1. WHEN valid projectId, oldPath, and newPath are provided, THE Project_Files_Module SHALL rename the file
2. WHEN a file already exists at newPath, THE Project_Files_Module SHALL return FileAlreadyExists error
3. WHEN the file at oldPath does not exist, THE Project_Files_Module SHALL return FileNotFound error
4. THE Project_Files_Module SHALL preserve all file content and metadata during rename
5. THE Project_Files_Module SHALL update updatedAt timestamp
6. THE Project_Files_Module SHALL enforce authorization before renaming file

### Requirement 9: Delete File Use Case

**User Story:** As an API client, I want to delete a file from a project, so that I can remove unused files and clean up project structure.

#### Acceptance Criteria

1. WHEN valid projectId and path are provided, THE Project_Files_Module SHALL delete the file
2. WHEN storageMode is object_storage, THE Project_Files_Module SHALL also remove the object from storage (Note: For Stage 1 with inline storage only, this is a future contract; object storage cleanup can be left as TODO/adapter stub)
3. WHEN the file does not exist, THE Project_Files_Module SHALL return FileNotFound error
4. THE Project_Files_Module SHALL enforce authorization before deleting file
5. THE Project_Files_Module SHALL ensure deletion is permanent and cannot be undone
6. FOR Stage 1 implementation: Object storage infrastructure is not active; implement inline storage deletion fully

### Requirement 10: Get Files For Compilation Use Case

**User Story:** As the compilation system, I want to retrieve all files needed for Typst compilation, so that I can compile the project document.

#### Acceptance Criteria

1. WHEN a valid projectId is provided, THE Project_Files_Module SHALL return all files with kind typst, bib, image, or data
2. THE Project_Files_Module SHALL include full content for inline files
3. THE Project_Files_Module SHALL include storageKey for object_storage files
4. THE Project_Files_Module SHALL return files in a format suitable for compilation input
5. THE Project_Files_Module SHALL enforce authorization before returning compilation files

### Requirement 11: Create Files From Template Use Case

**User Story:** As the projects module, I want to create initial files from a template, so that new projects start with template content.

#### Acceptance Criteria

1. WHEN a valid projectId and template file list are provided, THE Project_Files_Module SHALL create all template files
2. THE Project_Files_Module SHALL apply storage policy to each file
3. THE Project_Files_Module SHALL preserve template file paths and kinds
4. WHEN any file creation fails, THE Project_Files_Module SHALL return an error indicating which file failed
5. THE Project_Files_Module SHALL set createdAt and updatedAt for all created files

### Requirement 12: File HTTP API Routes

**User Story:** As an API client, I want RESTful HTTP endpoints for file operations, so that I can integrate file management into the editor frontend.

#### Acceptance Criteria

1. THE Project_Files_Module SHALL expose GET /api/v1/projects/:projectId/files for listing files
2. THE Project_Files_Module SHALL expose GET /api/v1/projects/:projectId/files/*path for retrieving a file
3. THE Project_Files_Module SHALL expose POST /api/v1/projects/:projectId/files for creating a file
4. THE Project_Files_Module SHALL expose PUT /api/v1/projects/:projectId/files/*path for updating a file
5. THE Project_Files_Module SHALL expose PATCH /api/v1/projects/:projectId/files/*path/rename for renaming a file
6. THE Project_Files_Module SHALL expose DELETE /api/v1/projects/:projectId/files/*path for deleting a file
7. THE Project_Files_Module SHALL validate all request bodies using Zod schemas
8. THE Project_Files_Module SHALL map domain errors to appropriate HTTP status codes (404 for NotFound, 409 for AlreadyExists, 400 for InvalidPath)

### Requirement 13: Project Entity Domain Model

**User Story:** As a backend developer, I want a well-defined Project entity in the domain layer, so that project operations follow clean architecture principles.

#### Acceptance Criteria

1. THE Project_Entity SHALL contain id, title, category, ownerId, createdAt, updatedAt, lastEditedAt fields
2. THE Project_Entity SHALL support TemplateCategory enumeration for category field
3. THE Project_Entity SHALL NOT import Prisma, Fastify, Zod, or any framework dependency
4. THE Project_Entity SHALL enforce that title is required and non-empty

### Requirement 14: Project Repository Port

**User Story:** As a backend developer, I want a repository port interface for project operations, so that the domain layer remains decoupled from Prisma implementation details.

#### Acceptance Criteria

1. THE Project_Repository SHALL define methods: create, findById, listByOwnerId, update, delete
2. THE Project_Repository SHALL return domain Project_Entity instances, not Prisma models
3. THE Project_Repository SHALL define error cases: ProjectNotFound, Unauthorized
4. THE Project_Repository SHALL NOT expose Prisma-specific types in its interface

### Requirement 15: Create Project Use Case

**User Story:** As an API client, I want to create a new project, so that I can start a new Typst document.

#### Acceptance Criteria

1. WHEN valid title, category, and ownerId are provided, THE Projects_Module SHALL create a new project
2. THE Projects_Module SHALL set createdAt and updatedAt to current timestamp
3. THE Projects_Module SHALL return the created project with generated id
4. THE Projects_Module SHALL enforce authorization to ensure user can create projects
5. THE Projects_Module SHALL validate that title is non-empty

### Requirement 16: Get Project Use Case

**User Story:** As an API client, I want to retrieve a specific project by id, so that I can load project metadata in the editor.

#### Acceptance Criteria

1. WHEN a valid projectId is provided, THE Projects_Module SHALL return the project entity
2. WHEN the project does not exist, THE Projects_Module SHALL return ProjectNotFound error
3. THE Projects_Module SHALL enforce authorization to ensure user can read the project
4. THE Projects_Module SHALL include all project fields: id, title, category, ownerId, createdAt, updatedAt, lastEditedAt

### Requirement 17: List Projects Use Case

**User Story:** As an API client, I want to list all projects owned by a user, so that I can display the user's project dashboard.

#### Acceptance Criteria

1. WHEN a valid userId is provided, THE Projects_Module SHALL return all projects owned by that user
2. THE Projects_Module SHALL return projects ordered by updatedAt descending (most recently updated first)
3. THE Projects_Module SHALL enforce authorization to ensure user can only list their own projects
4. WHEN the user has no projects, THE Projects_Module SHALL return an empty list

### Requirement 18: Update Project Use Case

**User Story:** As an API client, I want to update project metadata, so that I can change the project title or category.

#### Acceptance Criteria

1. WHEN valid projectId and updated fields are provided, THE Projects_Module SHALL update the project
2. THE Projects_Module SHALL update updatedAt to current timestamp
3. WHEN the project does not exist, THE Projects_Module SHALL return ProjectNotFound error
4. THE Projects_Module SHALL enforce authorization to ensure user can write to the project
5. THE Projects_Module SHALL validate that title remains non-empty if updated

### Requirement 19: Delete Project Use Case

**User Story:** As an API client, I want to delete a project, so that I can remove projects I no longer need.

#### Acceptance Criteria

1. WHEN a valid projectId is provided, THE Projects_Module SHALL delete the project
2. THE Projects_Module SHALL cascade delete all associated files (Note: For Stage 1, rely on database cascade to remove File records; custom storage cleanup logic is not needed unless object storage is actually implemented)
3. WHEN the project does not exist, THE Projects_Module SHALL return ProjectNotFound error
4. THE Projects_Module SHALL enforce authorization to ensure user can delete the project
5. THE Projects_Module SHALL ensure deletion is permanent and cannot be undone
6. FOR Stage 1 implementation: Database cascade handles File record removal; future object_storage support will require external blob cleanup in addition to DB cascade

### Requirement 20: Project Authorization Policies

**User Story:** As a backend developer, I want authorization policies in the domain layer, so that access control rules are enforced consistently.

#### Acceptance Criteria

1. THE Projects_Module SHALL define canRead policy: owner can read, admin can read all
2. THE Projects_Module SHALL define canWrite policy: owner can write, admin can write all
3. THE Projects_Module SHALL define canDelete policy: owner can delete, admin can delete all
4. THE Projects_Module SHALL apply policies in all use cases before performing operations
5. THE Projects_Module SHALL return Unauthorized error when policy check fails

### Requirement 21: Project HTTP API Routes

**User Story:** As an API client, I want RESTful HTTP endpoints for project operations, so that I can integrate project management into the editor frontend.

#### Acceptance Criteria

1. THE Projects_Module SHALL expose GET /api/v1/projects for listing projects
2. THE Projects_Module SHALL expose POST /api/v1/projects for creating a project
3. THE Projects_Module SHALL expose GET /api/v1/projects/:projectId for retrieving a project
4. THE Projects_Module SHALL expose PUT /api/v1/projects/:projectId for updating a project
5. THE Projects_Module SHALL expose DELETE /api/v1/projects/:projectId for deleting a project
6. THE Projects_Module SHALL validate all request bodies using Zod schemas
7. THE Projects_Module SHALL map domain errors to appropriate HTTP status codes (404 for NotFound, 403 for Unauthorized)

### Requirement 22: Prisma File Repository Implementation

**User Story:** As a backend developer, I want a Prisma-based implementation of the File Repository port, so that file operations persist to PostgreSQL.

#### Acceptance Criteria

1. THE PrismaFileRepository SHALL implement all methods defined in File_Repository port
2. THE PrismaFileRepository SHALL map Prisma File models to domain File_Entity instances
3. THE PrismaFileRepository SHALL handle Prisma errors and map them to domain errors
4. THE PrismaFileRepository SHALL use Prisma transactions for operations requiring atomicity
5. THE PrismaFileRepository SHALL reside in the infra layer and NOT be imported by domain

### Requirement 23: Prisma Project Repository Implementation

**User Story:** As a backend developer, I want a Prisma-based implementation of the Project Repository port, so that project operations persist to PostgreSQL.

#### Acceptance Criteria

1. THE PrismaProjectRepository SHALL implement all methods defined in Project_Repository port
2. THE PrismaProjectRepository SHALL map Prisma Project models to domain Project_Entity instances
3. THE PrismaProjectRepository SHALL handle Prisma errors and map them to domain errors
4. THE PrismaProjectRepository SHALL use Prisma transactions for operations requiring atomicity
5. THE PrismaProjectRepository SHALL reside in the infra layer and NOT be imported by domain

### Requirement 24: Module Dependency Wiring

**User Story:** As a backend developer, I want centralized dependency wiring for each module, so that use cases receive their dependencies without tight coupling.

#### Acceptance Criteria

1. THE Project_Files_Module SHALL provide a Container.ts that wires File_Repository to use cases
2. THE Projects_Module SHALL provide a Container.ts that wires Project_Repository to use cases
3. THE Container SHALL instantiate repositories and use cases once per module
4. THE Container SHALL NOT be imported by domain or application layers
5. THE Container SHALL be used by delivery layer to obtain use case instances

### Requirement 25: Module Public API

**User Story:** As a backend developer, I want a clean public API for each module, so that other modules can depend on well-defined interfaces.

#### Acceptance Criteria

1. THE Project_Files_Module SHALL export use cases, domain types, and errors from index.ts
2. THE Projects_Module SHALL export use cases, domain types, and errors from index.ts
3. THE index.ts SHALL NOT export infra implementations or delivery layer code
4. THE index.ts SHALL provide a stable API boundary for module consumers

### Requirement 26: Result Pattern for Use Cases

**User Story:** As a backend developer, I want use cases to return Result<T> types, so that errors are handled explicitly without throwing exceptions.

#### Acceptance Criteria

1. THE Project_Files_Module use cases SHALL return Result<T, Error> types
2. THE Projects_Module use cases SHALL return Result<T, Error> types
3. THE Result type SHALL support success and failure cases
4. THE delivery layer SHALL unwrap Result types and map to HTTP responses
5. THE Result pattern SHALL make error handling explicit and type-safe

### Requirement 27: Build and Type Safety

**User Story:** As a backend developer, I want the project to build successfully with strict TypeScript checks, so that type errors are caught at compile time.

#### Acceptance Criteria

1. WHEN npm run build is executed, THE build SHALL complete without TypeScript errors
2. THE build SHALL enforce strict mode, noUnusedLocals, and noUnusedParameters
3. THE build SHALL verify that all imports use .js extensions for ESM compatibility
4. THE build SHALL verify that domain layer has no framework imports
5. THE build SHALL verify that application layer has no Prisma or Fastify imports

### Requirement 28: Unit Tests for Use Cases

**User Story:** As a backend developer, I want unit tests for all use cases, so that business logic is verified independently of infrastructure.

#### Acceptance Criteria

1. THE Project_Files_Module SHALL have unit tests for all use cases using mock repositories
2. THE Projects_Module SHALL have unit tests for all use cases using mock repositories
3. THE unit tests SHALL verify success cases and error cases
4. THE unit tests SHALL NOT require a running database
5. THE unit tests SHALL achieve at least 80% code coverage for use case logic

### Requirement 29: Integration Tests for HTTP Routes

**User Story:** As a backend developer, I want integration tests for all HTTP routes, so that API contracts are verified end-to-end.

#### Acceptance Criteria

1. THE Project_Files_Module SHALL have integration tests for all HTTP routes
2. THE Projects_Module SHALL have integration tests for all HTTP routes
3. THE integration tests SHALL use a test database or in-memory Prisma client
4. THE integration tests SHALL verify request validation, authorization, and response mapping
5. THE integration tests SHALL verify HTTP status codes match domain error types

### Requirement 30: OpenAPI Documentation

**User Story:** As an API consumer, I want OpenAPI documentation for all endpoints, so that I can understand request/response schemas and test the API.

#### Acceptance Criteria

1. THE Project_Files_Module SHALL register all routes with Swagger schemas
2. THE Projects_Module SHALL register all routes with Swagger schemas
3. THE Swagger UI SHALL display all endpoints at /docs
4. THE Swagger schemas SHALL include request body, response body, and error response schemas
5. THE Swagger schemas SHALL be generated from Zod schemas using @asteasolutions/zod-to-openapi
