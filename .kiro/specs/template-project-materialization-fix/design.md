# Design — Template Project Materialization Fix

## 1. Tổng quan

Cải thiện error handling trong luồng template materialization khi tạo project bằng cách:

1. Tạo custom error class `InvalidTemplateVersionError`
2. Sử dụng error class thay vì generic Error
3. Cải thiện logging cho debugging
4. Đảm bảo error propagation rõ ràng qua module boundaries

## 2. Error Class Design

### 2.1 InvalidTemplateVersionError

```ts
// templates/domain/Errors.ts

export class InvalidTemplateVersionError extends Error {
  public readonly code = 'INVALID_TEMPLATE_VERSION';
  
  constructor(message: string = 'Phiên bản mẫu không hợp lệ hoặc không còn hoạt động') {
    super(message);
    this.name = 'InvalidTemplateVersionError';
    // Maintain proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InvalidTemplateVersionError);
    }
  }
}
```

**Rationale**:
- Extends `Error` để có stack trace
- `code` property để maintain consistency với existing error pattern
- Default message tiếng Việt
- `Error.captureStackTrace` để có clean stack trace

### 2.2 Export từ domain

```ts
// templates/domain/Errors.ts

export const TemplateErrors = {
  TEMPLATE_NOT_FOUND: {
    code: 'TEMPLATE_NOT_FOUND',
    message: 'Không tìm thấy mẫu',
  },
  // ... existing errors
  INVALID_TEMPLATE_VERSION: {
    code: 'INVALID_TEMPLATE_VERSION',
    message: 'Phiên bản mẫu không hợp lệ hoặc không còn hoạt động',
  },
};

// Export error class for cross-module use
export { InvalidTemplateVersionError };
```

## 3. Container Update

### 3.1 getMaterializeFunction()

```ts
// templates/Container.ts

import { InvalidTemplateVersionError } from './domain/Errors.js';

export class TemplatesContainer {
  // ... existing code

  /**
   * Get materialize function for cross-module use
   * 
   * This is used by projects module to materialize template versions.
   * Throws InvalidTemplateVersionError if version is invalid or inactive.
   */
  getMaterializeFunction() {
    return async (versionId: string) => {
      const result = await this.materializeTemplateVersion.execute(versionId);
      
      if (!result.success) {
        // Throw custom error class instead of generic Error
        if (result.error.code === 'INVALID_TEMPLATE_VERSION') {
          throw new InvalidTemplateVersionError(result.error.message);
        }
        
        // For other errors, throw generic Error
        throw new Error(result.error.message);
      }
      
      return result.data;
    };
  }
}
```

**Changes**:
- Import `InvalidTemplateVersionError`
- Throw custom error class for `INVALID_TEMPLATE_VERSION`
- Throw generic Error for other errors (with message)
- JSDoc updated

## 4. CreateProjectUseCase Update

### 4.1 Import error class

```ts
// projects/application/CreateProjectUseCase.ts

import { InvalidTemplateVersionError } from '../../templates/domain/Errors.js';
```

**Note**: This creates a dependency from `projects` → `templates` domain. This is acceptable because:
- It's domain-to-domain (not infra-to-infra)
- It's only for error handling (not business logic)
- Alternative would be to duplicate error class (worse)

### 4.2 Updated error handling

```ts
// projects/application/CreateProjectUseCase.ts

async execute(command: CreateProjectCommand): Promise<Result<Project>> {
  try {
    // ... existing project creation code

    // If templateVersionId is provided, materialize template files
    if (command.templateVersionId && this.materializeTemplate && this.fileRepo && this.settingsRepo) {
      try {
        console.log(`[CreateProject] Materializing template version ${command.templateVersionId} for project`);
        
        const files = await this.materializeTemplate(command.templateVersionId);
        
        console.log(`[CreateProject] Materialized ${files.length} files from template`);

        // Create files in project
        for (const file of files) {
          const content = file.content;
          const sizeBytes = Buffer.byteLength(content, 'utf-8');
          const sha256 = require('crypto').createHash('sha256').update(content).digest('hex');
          
          await this.fileRepo.create({
            projectId: project.id,
            path: file.path,
            kind: file.path.endsWith('.typ') ? FileKind.Typst : FileKind.Other,
            content: content,
            storageMode: 'inline',
            sizeBytes,
            sha256,
          });
        }

        // Update project settings with mainPath
        const settings = await this.settingsRepo.findOrCreate(project.id);
        const updatedSettings = new ProjectSettings(
          settings.projectId,
          'main.typ',
          settings.compileOptions,
          settings.zoteroConfig,
          new Date(),
        );
        await this.settingsRepo.update(updatedSettings);
        
        console.log(`[CreateProject] Successfully materialized template for project ${project.id}`);
      } catch (error) {
        // Catch custom error class
        if (error instanceof InvalidTemplateVersionError) {
          console.error(`[CreateProject] Invalid template version: ${error.message}`, error);
          return failure(error.code, error.message);
        }
        
        // Log unexpected errors
        console.error(`[CreateProject] Unexpected error during template materialization:`, error);
        throw error;
      }
    }

    return success(project);
  } catch (error) {
    console.error(`[CreateProject] Error creating project:`, error);
    return failure('INTERNAL_ERROR', 'Lỗi khi tạo dự án');
  }
}
```

**Changes**:
- Import `InvalidTemplateVersionError`
- Check `error instanceof InvalidTemplateVersionError` instead of `error.message`
- Add logging at key points
- Log errors with context
- Maintain existing behavior for other errors

## 5. Logging Strategy

### 5.1 Log levels

- `info`: Normal flow (start materialization, success)
- `error`: Errors (invalid template, unexpected errors)

### 5.2 Log format

```
[CreateProject] <message> <context>
```

**Context includes**:
- `projectId` (after creation)
- `templateVersionId`
- `userId` (from command)
- File count
- Error details

### 5.3 Example logs

**Success**:
```
[CreateProject] Materializing template version abc123 for project
[CreateProject] Materialized 3 files from template
[CreateProject] Successfully materialized template for project xyz789
```

**Error**:
```
[CreateProject] Invalid template version: Phiên bản mẫu không hợp lệ hoặc không còn hoạt động
InvalidTemplateVersionError: Phiên bản mẫu không hợp lệ hoặc không còn hoạt động
    at TemplatesContainer.getMaterializeFunction (...)
    at CreateProjectUseCase.execute (...)
```

## 6. Error Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ CreateProjectUseCase.execute()                              │
│                                                             │
│  1. Create project                                          │
│  2. If templateVersionId:                                   │
│     ┌─────────────────────────────────────────────────┐   │
│     │ materializeTemplate(versionId)                  │   │
│     │   ↓                                             │   │
│     │ TemplatesContainer.getMaterializeFunction()    │   │
│     │   ↓                                             │   │
│     │ MaterializeTemplateVersionUseCase.execute()    │   │
│     │   ↓                                             │   │
│     │ Result { success: false, error: {...} }        │   │
│     │   ↓                                             │   │
│     │ throw new InvalidTemplateVersionError()        │   │
│     └─────────────────────────────────────────────────┘   │
│     ↓                                                       │
│  3. catch (error instanceof InvalidTemplateVersionError)   │
│     → return failure(error.code, error.message)            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 7. Module Dependency

```
projects/application/CreateProjectUseCase
  ↓ (imports error class)
templates/domain/Errors
  ↓ (exports)
InvalidTemplateVersionError
```

**Dependency direction**: `projects` → `templates` (domain only)

**Justification**:
- Domain-to-domain dependency is acceptable in Clean Architecture
- Error classes are part of domain contract
- Alternative (duplicate error class) is worse
- No circular dependency (templates doesn't import from projects)

## 8. Testing Strategy

### 8.1 Unit tests to update

**templates/__tests__/MaterializeTemplateVersion.test.ts**:
- No changes needed (already tests Result pattern)

**projects/__tests__/CreateProject.test.ts** (new tests):
- Test: Invalid templateVersionId throws InvalidTemplateVersionError
- Test: Inactive template version throws InvalidTemplateVersionError
- Test: Error message is returned in failure result
- Test: Project is created even if materialization fails (acceptable behavior)

### 8.2 Integration tests

**scripts/test-templates-public-api.ts**:
- Test: Create project with valid templateVersionId → success
- Test: Create project with invalid templateVersionId → 400 error
- Test: Create project with inactive templateVersionId → 400 error

## 9. Backward Compatibility

### 9.1 API contract

**No changes**:
- HTTP status codes remain same
- Response format remains same
- Error codes remain same

### 9.2 Behavior

**No changes**:
- Projects without templateVersionId work as before
- Error messages remain same (Vietnamese)
- Project creation flow remains same

### 9.3 Database

**No changes**:
- No schema changes
- No migration needed

## 10. Rollout Plan

### Phase 1: Implementation
1. Add `InvalidTemplateVersionError` to templates/domain/Errors.ts
2. Update TemplatesContainer.getMaterializeFunction()
3. Update CreateProjectUseCase error handling
4. Add logging

### Phase 2: Testing
1. Run unit tests
2. Run API tests
3. Manual testing with Swagger UI

### Phase 3: Verification
1. Check logs for proper error messages
2. Verify error responses in API
3. Verify backward compatibility

## 11. Monitoring

### Metrics to track (future)
- Template materialization success rate
- Most common error codes
- Average materialization time
- File count distribution

### Logs to monitor
- `[CreateProject] Invalid template version` - indicates user trying to use inactive template
- `[CreateProject] Unexpected error` - indicates bug or infrastructure issue

## 12. Future Improvements

### Phase 2 (out of scope for this fix)
- Retry logic for transient storage errors
- Rollback project if materialization fails
- Metrics/monitoring dashboard
- Template materialization queue for large templates
- Async materialization with webhook notification

