/**
 * Unit Tests for RenameFileUseCase
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { RenameFileUseCase } from '../application/RenameFileUseCase.js';
import { MockFileRepo } from './mocks/MockFileRepo.js';
import { MockProjectRepo } from './mocks/MockProjectRepo.js';
import { FileKind, StorageMode, type File } from '../domain/ProjectFile/Types.js';
import { FileErrors } from '../domain/ProjectFile/Errors.js';
import { TemplateCategory, type Project } from '../../projects/domain/Project/Types.js';

describe('RenameFileUseCase', () => {
  let useCase: RenameFileUseCase;
  let mockFileRepo: MockFileRepo;
  let mockProjectRepo: MockProjectRepo;
  let testProject: Project;
  let testFile: File;

  beforeEach(() => {
    mockFileRepo = new MockFileRepo();
    mockProjectRepo = new MockProjectRepo();
    useCase = new RenameFileUseCase(mockFileRepo, mockProjectRepo);

    testProject = {
      id: 'project-1',
      title: 'Test Project',
      category: TemplateCategory.Thesis,
      ownerId: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastEditedAt: null,
    };
    mockProjectRepo.setProjects([testProject]);

    testFile = {
      id: 'file-1',
      projectId: 'project-1',
      path: 'old-name.typ',
      kind: FileKind.Typst,
      storageMode: StorageMode.Inline,
      textContent: 'content',
      storageKey: null,
      mimeType: 'text/plain',
      sizeBytes: 7,
      sha256: 'hash',
      lastEditedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockFileRepo.setFiles([testFile]);
  });

  it('should rename file successfully', async () => {
    const command = {
      projectId: 'project-1',
      oldPath: 'old-name.typ',
      newPath: 'new-name.typ',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.path, 'new-name.typ');
      assert.strictEqual(result.data.textContent, 'content'); // Content preserved
      assert.strictEqual(result.data.sizeBytes, 7); // Metadata preserved
    }
  });

  it('should preserve all file metadata during rename', async () => {
    const command = {
      projectId: 'project-1',
      oldPath: 'old-name.typ',
      newPath: 'new-name.typ',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.id, testFile.id);
      assert.strictEqual(result.data.kind, testFile.kind);
      assert.strictEqual(result.data.sha256, testFile.sha256);
      assert.strictEqual(result.data.mimeType, testFile.mimeType);
    }
  });

  it('should return PROJECT_NOT_FOUND when project does not exist', async () => {
    const command = {
      projectId: 'non-existent',
      oldPath: 'old-name.typ',
      newPath: 'new-name.typ',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, FileErrors.PROJECT_NOT_FOUND.code);
    }
  });

  it('should return FILE_NOT_FOUND when file does not exist at oldPath', async () => {
    const command = {
      projectId: 'project-1',
      oldPath: 'non-existent.typ',
      newPath: 'new-name.typ',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, FileErrors.FILE_NOT_FOUND.code);
    }
  });

  it('should return FILE_ALREADY_EXISTS when file exists at newPath', async () => {
    // Add another file at the target path
    const conflictFile: File = {
      id: 'file-2',
      projectId: 'project-1',
      path: 'new-name.typ',
      kind: FileKind.Typst,
      storageMode: StorageMode.Inline,
      textContent: 'other content',
      storageKey: null,
      mimeType: 'text/plain',
      sizeBytes: 13,
      sha256: 'other-hash',
      lastEditedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockFileRepo.setFiles([testFile, conflictFile]);

    const command = {
      projectId: 'project-1',
      oldPath: 'old-name.typ',
      newPath: 'new-name.typ',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, FileErrors.FILE_ALREADY_EXISTS.code);
    }
  });

  it('should return UNAUTHORIZED when user is not owner', async () => {
    const command = {
      projectId: 'project-1',
      oldPath: 'old-name.typ',
      newPath: 'new-name.typ',
      userId: 'user-456',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, FileErrors.UNAUTHORIZED.code);
    }
  });

  it('should allow admin to rename file in any project', async () => {
    const command = {
      projectId: 'project-1',
      oldPath: 'old-name.typ',
      newPath: 'admin-renamed.typ',
      userId: 'admin-456',
      userRole: 'admin' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.path, 'admin-renamed.typ');
    }
  });

  it('should reject newPath with ../', async () => {
    const command = {
      projectId: 'project-1',
      oldPath: 'old-name.typ',
      newPath: '../escape.typ',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, FileErrors.INVALID_FILE_PATH.code);
    }
  });

  it('should reject newPath starting with ./', async () => {
    const command = {
      projectId: 'project-1',
      oldPath: 'old-name.typ',
      newPath: './relative.typ',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, FileErrors.INVALID_FILE_PATH.code);
    }
  });

  it('should reject absolute newPath', async () => {
    const command = {
      projectId: 'project-1',
      oldPath: 'old-name.typ',
      newPath: '/absolute/path.typ',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, FileErrors.INVALID_FILE_PATH.code);
    }
  });

  it('should reject empty newPath', async () => {
    const command = {
      projectId: 'project-1',
      oldPath: 'old-name.typ',
      newPath: '',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, FileErrors.INVALID_FILE_PATH.code);
    }
  });

  it('should allow renaming to subdirectory path', async () => {
    const command = {
      projectId: 'project-1',
      oldPath: 'old-name.typ',
      newPath: 'chapters/chapter1.typ',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.path, 'chapters/chapter1.typ');
    }
  });
});
