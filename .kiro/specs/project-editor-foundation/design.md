# Design Document: Project Editor Foundation

## Overview

This design document specifies the backend implementation for the **Project Editor Foundation** feature, which establishes the foundational persistence and CRUD capabilities for two core modules:

1. **project-files module**: Complete file lifecycle management (create, read, update, rename, delete) for Typst source files, bibliographies, images, data files, and other assets within projects
2. **projects module**: Basic project lifecycle management (create, read, update, delete, list) for project containers

### Stage 1 Scope

This design focuses on **Stage 1 implementation** with the following constraints:

- **Inline storage only**: File content stored directly in the database (`textContent` field)
- **No object storage**: Object storage infrastructure (S3, R2, MinIO) is not active in Stage 1
- **Database cascade for cleanup**: Project deletion relies on Prisma cascade to remove File records
- **Future-ready contracts**: Domain models and ports include `storageMode` and `storageKey` fields to support future object storage, but Stage 1 implementation focuses on inline storage

### Design Goals

- Establish clean architecture boundaries for both modules
- Provide type-safe, testable use cases with explicit error handling
- Support the hybrid editor model where backend is the authoritative source of truth
- Enable future extensibility for object storage without breaking existing contracts
- Maintain strict separation between domain, application, infrastructure, and delivery layers

### Key Design Decisions

1. **Storage Strategy**: Stage 1 uses inline storage (`textContent`) for all files; storage policy logic is implemented but always selects inline mode
2. **Error Handling**: Use Result pattern for explicit error handling without exceptions
3. **Authorization**: Leverage existing auth module; implement domain-level authorization policies
4. **Repository Pattern**: Define ports in domain layer, implement with Prisma in infrastructure layer
5. **Dependency Wiring**: Centralized Container.ts per module for dependency injection
6. **API Design**: RESTful HTTP endpoints with Zod validation and OpenAPI documentation

---

## Architecture

### Module Structure

Both modules follow the standard clean architecture layout matching existing codebase conventions (see `admin` and `auth` modules):

```
src/modules/project-files/
  domain/
    File/
      Types.ts           # File entity, FileKind, StorageMode, CreateFileData, etc.
      Ports.ts           # FileRepo interface
      Errors.ts          # FileErrors constants
      Policies.ts        # StoragePolicy (determineStorageMode)
  application/
    File/
      CreateFileUseCase.ts
      GetFileUseCase.ts
      ListFilesUseCase.ts
      UpdateFileUseCase.ts
      RenameFileUseCase.ts
      DeleteFileUseCase.ts
      GetFilesForCompilationUseCase.ts
      CreateFilesFromTemplateUseCase.ts
    Types.ts             # Result<T>, success(), failure()
  infra/
    FileRepoPrisma.ts
  delivery/
    http/
      File/
        Dto.ts           # Zod schemas and OpenAPI annotations
        Routes.ts        # Fastify route registration
    ws/                  # (empty for now)
  Container.ts
  index.ts

src/modules/projects/
  domain/
    Project/
      Types.ts           # Project entity, TemplateCategory, CreateProjectData, etc.
      Ports.ts           # ProjectRepo interface
      Errors.ts          # ProjectErrors constants
      Policies.ts        # ProjectAuthPolicy (canRead, canWrite, canDelete)
  application/
    Project/
      CreateProjectUseCase.ts
      GetProjectUseCase.ts
      ListProjectsUseCase.ts
      UpdateProjectUseCase.ts
      DeleteProjectUseCase.ts
    Types.ts             # Result<T>, success(), failure()
  infra/
    ProjectRepoPrisma.ts
  delivery/
    http/
      Project/
        Dto.ts           # Zod schemas and OpenAPI annotations
        Routes.ts        # Fastify route registration
    ws/                  # (empty for now)
  Container.ts
  index.ts
```

**Key Conventions** (matching existing `admin` and `auth` modules):
- Domain layer organized by subdomain: `domain/<Subdomain>/Types.ts`, `Ports.ts`, `Errors.ts`, `Policies.ts`
- Application layer organized by subdomain: `application/<Subdomain>/*UseCase.ts`
- Infrastructure layer: flat structure with `*RepoPrisma.ts` naming
- Delivery layer organized by subdomain: `delivery/http/<Subdomain>/Dto.ts`, `Routes.ts`
- Subdomain names: `Project` for projects module, `File` for project-files module

### Dependency Flow

```
┌─────────────────────────────────────────────────┐
│              Delivery Layer (HTTP)              │
│  - Routes.ts: Fastify route registration        │
│  - Dto.ts: Zod schemas, validation, OpenAPI     │
└────────────────┬────────────────────────────────┘
                 │ depends on
                 ▼
┌─────────────────────────────────────────────────┐
│           Application Layer (Use Cases)         │
│  - Use case orchestration                       │
│  - Result<T, E> return types                    │
│  - Business workflow coordination               │
└────────────────┬────────────────────────────────┘
                 │ depends on
                 ▼
┌─────────────────────────────────────────────────┐
│              Domain Layer (Core)                │
│  - Entities: File, Project                      │
│  - Ports: FileRepository, ProjectRepository     │
│  - Policies: StoragePolicy, AuthPolicy          │
│  - Errors: Domain-specific error types          │
└─────────────────────────────────────────────────┘
                 ▲
                 │ implements
                 │
┌─────────────────────────────────────────────────┐
│         Infrastructure Layer (Adapters)         │
│  - PrismaFileRepository                         │
│  - PrismaProjectRepository                      │
│  - Prisma client usage                          │
└─────────────────────────────────────────────────┘
```

### Cross-Module Dependencies

- **projects module** may call **project-files module** use cases for template file creation
- **compile module** (existing) will call **project-files module** use cases to retrieve files for compilation
- Both modules depend on **auth module** for user identity and authorization

---

## Components and Interfaces

### Domain Layer Components

#### File Entity

```typescript
// src/modules/project-files/domain/File/Types.ts

export enum FileKind {
  Typst = 'typst',
  Bib = 'bib',
  Image = 'image',
  Data = 'data',
  Other = 'other',
}

export enum StorageMode {
  Inline = 'inline',
  ObjectStorage = 'object_storage',
}

export interface File {
  id: string;
  projectId: string;
  path: string;
  kind: FileKind;
  storageMode: StorageMode;
  textContent: string | null;
  storageKey: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  lastEditedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFileData {
  projectId: string;
  path: string;
  kind: FileKind;
  content: string;
  mimeType?: string;
}

export interface UpdateFileData {
  projectId: string;
  path: string;
  content: string;
}

export interface RenameFileData {
  projectId: string;
  oldPath: string;
  newPath: string;
}
```

#### Project Entity

```typescript
// src/modules/projects/domain/Project/Types.ts

export enum TemplateCategory {
  Thesis = 'thesis',
  Report = 'report',
  Proposal = 'proposal',
  Paper = 'paper',
  Presentation = 'presentation',
  Other = 'other',
}

export interface Project {
  id: string;
  title: string;
  category: TemplateCategory;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastEditedAt: Date | null;
}

export interface CreateProjectData {
  title: string;
  category: TemplateCategory;
  ownerId: string;
}

export interface UpdateProjectData {
  projectId: string;
  title?: string;
  category?: TemplateCategory;
}
```

#### Repository Ports

```typescript
// src/modules/project-files/domain/File/Ports.ts

export interface FileRepo {
  create(data: CreateFileData): Promise<File>;
  findById(id: string): Promise<File | null>;
  findByProjectIdAndPath(projectId: string, path: string): Promise<File | null>;
  listByProjectId(projectId: string): Promise<File[]>;
  update(data: UpdateFileData): Promise<File>;
  rename(data: RenameFileData): Promise<File>;
  delete(projectId: string, path: string): Promise<void>;
  findForCompilation(projectId: string): Promise<File[]>;
}

// src/modules/projects/domain/Project/Ports.ts

export interface ProjectRepo {
  create(data: CreateProjectData): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  listByOwnerId(ownerId: string): Promise<Project[]>;
  update(data: UpdateProjectData): Promise<Project>;
  delete(projectId: string): Promise<void>;
}
```

#### Domain Errors

```typescript
// src/modules/project-files/domain/File/Errors.ts

export const FileErrors = {
  FILE_NOT_FOUND: {
    code: 'FILE_NOT_FOUND',
    message: 'Không tìm thấy tệp',
  },
  FILE_ALREADY_EXISTS: {
    code: 'FILE_ALREADY_EXISTS',
    message: 'Tệp đã tồn tại',
  },
  INVALID_FILE_PATH: {
    code: 'INVALID_FILE_PATH',
    message: 'Đường dẫn tệp không hợp lệ',
  },
} as const;

// src/modules/projects/domain/Project/Errors.ts

export const ProjectErrors = {
  PROJECT_NOT_FOUND: {
    code: 'PROJECT_NOT_FOUND',
    message: 'Không tìm thấy dự án',
  },
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: 'Không có quyền truy cập',
  },
} as const;
```

#### Domain Policies

```typescript
// src/modules/project-files/domain/File/Policies.ts

export class StoragePolicy {
  /**
   * Determines storage mode based on file size and kind.
   * Stage 1: Always returns 'inline' since object storage is not active.
   * Future: Will return 'object_storage' for large files or binary content.
   */
  static determineStorageMode(
    sizeBytes: number,
    kind: FileKind
  ): StorageMode {
    // Stage 1: Always use inline storage
    return StorageMode.Inline;
    
    // Future implementation (commented out for Stage 1):
    // const SIZE_THRESHOLD = 1024 * 1024; // 1MB
    // if (sizeBytes >= SIZE_THRESHOLD) {
    //   return StorageMode.ObjectStorage;
    // }
    // if (kind === FileKind.Image || kind === FileKind.Data) {
    //   return StorageMode.ObjectStorage;
    // }
    // return StorageMode.Inline;
  }
}

// src/modules/projects/domain/Project/Policies.ts

export interface AuthContext {
  userId: string;
  role: 'admin' | 'teacher' | 'student';
}

export class ProjectAuthPolicy {
  static canRead(project: Project, auth: AuthContext): boolean {
    if (auth.role === 'admin') return true;
    return project.ownerId === auth.userId;
  }

  static canWrite(project: Project, auth: AuthContext): boolean {
    if (auth.role === 'admin') return true;
    return project.ownerId === auth.userId;
  }

  static canDelete(project: Project, auth: AuthContext): boolean {
    if (auth.role === 'admin') return true;
    return project.ownerId === auth.userId;
  }
}
```

### Application Layer Components

#### Result Pattern

```typescript
// src/modules/project-files/application/Types.ts
// src/modules/projects/application/Types.ts

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

export function failure(code: string, message: string): Result<never> {
  return { success: false, error: { code, message } };
}
```

#### Use Case Interfaces

```typescript
// Example: CreateFileUseCase

export interface CreateFileCommand {
  projectId: string;
  path: string;
  kind: FileKind;
  content: string;
  mimeType?: string;
  userId: string; // for authorization
}

export class CreateFileUseCase {
  constructor(
    private fileRepo: FileRepo,
    private projectRepo: ProjectRepo
  ) {}

  async execute(command: CreateFileCommand): Promise<Result<File>> {
    // 1. Verify project exists
    // 2. Check authorization
    // 3. Validate path
    // 4. Check if file already exists
    // 5. Compute size, hash
    // 6. Determine storage mode
    // 7. Create file via repository
    // 8. Return result
  }
}
```

### Infrastructure Layer Components

#### Prisma Repository Implementation

```typescript
// src/modules/project-files/infra/FileRepoPrisma.ts

export class FileRepoPrisma implements FileRepo {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateFileData): Promise<File> {
    // Map domain data to Prisma create
    // Handle Prisma errors and map to domain errors
    // Return domain File entity
  }

  async findByProjectIdAndPath(
    projectId: string,
    path: string
  ): Promise<File | null> {
    // Query Prisma with unique constraint
    // Map Prisma model to domain entity
  }

  // ... other methods
}
```

### Delivery Layer Components

#### HTTP Routes

```typescript
// src/modules/project-files/delivery/http/File/Routes.ts

export async function registerFileRoutes(app: FastifyInstance) {
  // GET /api/v1/projects/:projectId/files
  app.get(
    '/api/v1/projects/:projectId/files',
    {
      preHandler: app.auth.verify,
      schema: {
        tags: ['Files'],
        summary: 'List files in a project',
        params: ProjectIdParamSchema,
        response: {
          200: FileListResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      // Extract params
      // Call use case
      // Map result to HTTP response
    }
  );

  // GET /api/v1/projects/:projectId/files/*path
  // POST /api/v1/projects/:projectId/files
  // PUT /api/v1/projects/:projectId/files/*path
  // PATCH /api/v1/projects/:projectId/files:rename?path=...
  // DELETE /api/v1/projects/:projectId/files/*path
}
```

#### DTOs and Validation

```typescript
// src/modules/project-files/delivery/http/File/Dto.ts

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const FileKindSchema = z.enum(['typst', 'bib', 'image', 'data', 'other']);

export const CreateFileRequestSchema = z.object({
  path: z.string().min(1).openapi({ example: 'main.typ' }),
  kind: FileKindSchema,
  content: z.string().openapi({ example: '#heading[My Document]' }),
  mimeType: z.string().optional(),
});

export const FileMetadataSchema = z.object({
  id: z.string(),
  path: z.string(),
  kind: FileKindSchema,
  mimeType: z.string().nullable(),
  sizeBytes: z.number().nullable(),
  lastEditedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const FileListResponseSchema = z.object({
  files: z.array(FileMetadataSchema),
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
});
```

---

## Data Models

### Prisma Schema

The existing Prisma schema already includes the necessary models. No schema changes are required for Stage 1:

```prisma
model Project {
  id           String           @id @default(cuid())
  title        String
  category     TemplateCategory @default(other)
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt
  ownerId      String?
  owner        User?            @relation("ProjectOwner", fields: [ownerId], references: [id], onDelete: SetNull)
  lastEditedAt DateTime?
  
  // ... other fields and relations
  files        File[]
  
  @@index([category])
}

model File {
  id           String   @id @default(cuid())
  projectId    String
  project      Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  path         String
  kind         FileKind @default(other)
  textContent  String?  @map("content") @db.Text
  storageKey   String?
  mimeType     String?
  sizeBytes    Int?
  sha256       String?
  lastEditedAt DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([projectId, path])
  @@index([projectId])
}

enum FileKind {
  typst
  bib
  image
  data
  other
}

enum TemplateCategory {
  thesis
  report
  proposal
  paper
  presentation
  other
}
```

### Database Relationships

- **Project → File**: One-to-many with cascade delete
- **User → Project**: One-to-many (owner relationship)
- **File.projectId + File.path**: Unique constraint ensures no duplicate paths within a project

### Stage 1 Storage Strategy

- **textContent field**: Stores file content directly in PostgreSQL
- **storageKey field**: Reserved for future object storage; NULL in Stage 1
- **storageMode**: Not stored in database; determined by domain policy at runtime

---

## Error Handling

### Error Mapping Strategy

Domain errors are mapped to HTTP status codes in the delivery layer:

| Domain Error | HTTP Status | Description |
|---|---|---|
| `FILE_NOT_FOUND` | 404 Not Found | File does not exist at specified path |
| `FILE_ALREADY_EXISTS` | 409 Conflict | File already exists at specified path |
| `INVALID_FILE_PATH` | 400 Bad Request | File path format is invalid |
| `PROJECT_NOT_FOUND` | 404 Not Found | Project does not exist |
| `UNAUTHORIZED` | 403 Forbidden | User lacks permission for operation |

### Error Response Format

All error responses follow a consistent structure:

```json
{
  "error": "FileNotFoundError",
  "message": "File not found: main.typ in project abc123"
}
```

### Error Handling Flow

```
Use Case
  ↓ Returns Result<T, Error>
Delivery Layer
  ↓ Unwraps Result
  ↓ Maps Error to HTTP status
  ↓ Formats error response
HTTP Response
```

### Prisma Error Handling

Infrastructure layer catches Prisma errors and maps them to domain errors:

- `PrismaClientKnownRequestError` with code `P2002` (unique constraint) → `FILE_ALREADY_EXISTS`
- `PrismaClientKnownRequestError` with code `P2025` (record not found) → `FILE_NOT_FOUND`
- Other Prisma errors → Generic error with appropriate logging

---

## Testing Strategy

### Unit Tests

**Scope**: Test use cases in isolation with mock repositories

**Approach**:
- Mock `FileRepository` and `ProjectRepository` interfaces
- Test success paths and error paths for each use case
- Verify authorization policy enforcement
- Verify storage policy application
- No database required

**Coverage Target**: 80%+ for use case logic

**Example Test Cases**:
- `CreateFileUseCase`: successful creation, file already exists, project not found, unauthorized
- `ListFilesUseCase`: successful list, empty list, project not found, unauthorized
- `DeleteFileUseCase`: successful deletion, file not found, unauthorized

### Integration Tests

**Scope**: Test HTTP routes end-to-end with test database

**Approach**:
- Use in-memory SQLite or test PostgreSQL instance
- Test request validation (Zod schemas)
- Test authorization enforcement
- Test HTTP status code mapping
- Test response format compliance

**Coverage Target**: All HTTP endpoints

**Example Test Cases**:
- `POST /api/v1/projects/:projectId/files`: valid request returns 201, invalid path returns 400, duplicate file returns 409
- `GET /api/v1/projects/:projectId/files`: returns file list, returns 404 for non-existent project
- `DELETE /api/v1/projects/:projectId/files/*path`: returns 204, returns 404 for non-existent file

### Repository Tests

**Scope**: Test Prisma repository implementations

**Approach**:
- Use test database with migrations applied
- Test CRUD operations
- Test unique constraints
- Test cascade behavior
- Test error mapping

**Example Test Cases**:
- `PrismaFileRepository.create`: creates file, enforces unique constraint
- `PrismaFileRepository.listByProjectId`: returns files ordered by path
- `PrismaProjectRepository.delete`: cascades to delete files

### Manual Testing

**Scope**: Swagger UI exploratory testing

**Approach**:
- Use `/docs` endpoint to test API interactively
- Verify request/response schemas
- Test authorization with valid/invalid tokens
- Test edge cases (empty strings, special characters, large files)

---

## Dependency Wiring Strategy

### Container Pattern

Each module provides a `Container.ts` that encapsulates dependency creation:

```typescript
// src/modules/project-files/Container.ts

import { PrismaClient } from '../../generated/prisma/client.js';
import { FileRepoPrisma } from './infra/FileRepoPrisma.js';
import { CreateFileUseCase } from './application/File/CreateFileUseCase.js';
// ... other imports

export class ProjectFilesContainer {
  private fileRepo: FileRepo;
  private createFileUseCase: CreateFileUseCase;
  // ... other use cases

  constructor(prisma: PrismaClient, projectRepo: ProjectRepo) {
    this.fileRepo = new FileRepoPrisma(prisma);
    this.createFileUseCase = new CreateFileUseCase(
      this.fileRepo,
      projectRepo
    );
    // ... initialize other use cases
  }

  getCreateFileUseCase(): CreateFileUseCase {
    return this.createFileUseCase;
  }

  // ... other getters
}
```

### Route Registration

Routes receive use cases from the container:

```typescript
// src/modules/project-files/delivery/http/File/Routes.ts

export async function registerFileRoutes(
  app: FastifyInstance,
  container: ProjectFilesContainer
) {
  app.post('/api/v1/projects/:projectId/files', async (request, reply) => {
    const useCase = container.getCreateFileUseCase();
    const result = await useCase.execute(command);
    // ... handle result
  });
}
```

### App-Level Wiring

The main app initializes containers and registers routes:

```typescript
// src/app.ts or src/api/index.ts

import { ProjectFilesContainer } from './modules/project-files/Container.js';
import { ProjectsContainer } from './modules/projects/Container.js';
import { registerFileRoutes } from './modules/project-files/delivery/http/Routes.js';
import { registerProjectRoutes } from './modules/projects/delivery/http/Routes.js';

export async function buildApp() {
  const app = Fastify();
  
  // Register plugins (Prisma, JWT, etc.)
  await app.register(prismaPlugin);
  await app.register(jwtPlugin);
  
  // Initialize containers
  const projectsContainer = new ProjectsContainer(app.prisma);
  const filesContainer = new ProjectFilesContainer(
    app.prisma,
    projectsContainer.getProjectRepository()
  );
  
  // Register routes
  await app.register(registerProjectRoutes, { container: projectsContainer });
  await app.register(registerFileRoutes, { container: filesContainer });
  
  return app;
}
```

---

## Implementation Notes

### Stage 1 Constraints

1. **Inline Storage Only**: All file content stored in `textContent` field
2. **No Object Storage Cleanup**: Delete operations only remove database records
3. **Storage Policy Simplified**: Always returns `StorageMode.Inline`
4. **Database Cascade**: Project deletion relies on Prisma cascade for File cleanup

### Future Extensibility

The design includes hooks for future object storage support:

1. **StorageMode enum**: Already defined with `object_storage` value
2. **storageKey field**: Present in schema and domain model
3. **Storage Policy**: Can be updated to return `object_storage` based on size/kind
4. **Repository Port**: Can be extended with storage cleanup methods
5. **Infrastructure Adapter**: New `ObjectStorageAdapter` can be added without changing domain

### Authorization Integration

- Use existing `app.auth.verify` preHandler for JWT verification
- Extract `userId` and `role` from JWT payload
- Pass `AuthContext` to use cases for policy enforcement
- Domain policies remain framework-agnostic

### Path Validation

File paths must be validated to prevent:
- Directory traversal attacks (`../`, `./`)
- Absolute paths (`/etc/passwd`)
- Empty paths
- Paths with invalid characters

Validation logic resides in domain layer or use case layer.

### Content Hashing

- Compute SHA-256 hash of file content on create/update
- Store hash in `sha256` field for integrity verification
- Use Node.js `crypto` module in use case layer

### Timestamp Management

- `createdAt`: Set by Prisma on insert
- `updatedAt`: Set by Prisma on update
- `lastEditedAt`: Set by use case on content modification (create/update)

---

## OpenAPI Documentation

### Swagger Integration

- Use `@fastify/swagger` and `@fastify/swagger-ui` plugins
- Generate schemas from Zod using `@asteasolutions/zod-to-openapi`
- Serve documentation at `/docs`

### Schema Annotations

```typescript
export const CreateFileRequestSchema = z.object({
  path: z.string().min(1).openapi({
    description: 'File path relative to project root',
    example: 'chapters/intro.typ',
  }),
  kind: FileKindSchema.openapi({
    description: 'File type classification',
  }),
  content: z.string().openapi({
    description: 'File content (UTF-8 text)',
    example: '#heading[Introduction]\n\nThis is the introduction.',
  }),
  mimeType: z.string().optional().openapi({
    description: 'MIME type (optional)',
    example: 'text/plain',
  }),
});
```

### Route Documentation

```typescript
app.post('/api/v1/projects/:projectId/files', {
  schema: {
    tags: ['Files'],
    summary: 'Create a new file in a project',
    description: 'Creates a new file with the specified path and content. Returns 409 if file already exists.',
    params: ProjectIdParamSchema,
    body: CreateFileRequestSchema,
    response: {
      201: FileResponseSchema,
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
      409: ErrorResponseSchema,
    },
    security: [{ bearerAuth: [] }],
  },
}, handler);
```

---

## Summary

This design establishes a solid foundation for project and file management with:

- **Clean Architecture**: Strict layer separation with domain at the core
- **Type Safety**: TypeScript throughout with Zod validation
- **Explicit Error Handling**: Result pattern for predictable error flows
- **Testability**: Mock-friendly interfaces and dependency injection
- **Future-Ready**: Extensible for object storage without breaking changes
- **Stage 1 Focus**: Inline storage implementation with clear migration path

The implementation prioritizes correctness, maintainability, and alignment with the hybrid editor model where the backend remains the authoritative source of truth for project structure and file content.
