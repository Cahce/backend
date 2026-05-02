/**
 * Unit Tests for UpdateFileUseCase
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { UpdateFileUseCase } from '../application/UpdateFileUseCase.js';
import { MockFileRepo } from './mocks/MockFileRepo.js';
import { MockProjectRepo } from './mocks/MockProjectRepo.js';
import { FileKind, StorageMode, type File } from '../domain/ProjectFile/Types.js';
import { FileErrors } from '../domain/ProjectFile/Errors.js';
import { TemplateCategory, type Project } from '../../projects/domain/Project/Types.js';

describe('UpdateFileUseCase', () => {
  let useCase: UpdateFileUseCase;
  let mockFileRepo: MockFileRepo;
  let mockProjectRepo: MockProjectRepo;
  let testProject: Project;
  let testFile: File;

  beforeEach(() => {
    mockFileRepo = new MockFileRepo();
    mockProjectRepo = new MockProjectRepo();
    useCase = new UpdateFileUseCase(mockFileRepo, mockProjectRepo);

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
      path: 'main.typ',
      kind: FileKind.Typst,
      storageMode: StorageMode.Inline,
      textContent: 'old content',
      storageKey: null,
      mimeType: 'text/plain',
      sizeBytes: 11,
      sha256: 'old-hash',
      lastEditedAt: new Date('2024-01-01'),
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };
    mockFileRepo.setFiles([testFile]);
  });

  it('should update file content successfully', async () => {
    const command = {
      projectId: 'project-1',
      path: 'main.typ',
      content: 'new content',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.textContent, 'new content');
      assert.strictEqual(result.data.path, 'main.typ');
    }
  });

  it('should recompute size and hash after update', async () => {
    const newContent = 'updated content with more text';
    const command = {
      projectId: 'project-1',
      path: 'main.typ',
      content: newContent,
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      // Verify size is recomputed
      const expectedSize = Buffer.byteLength(newContent, 'utf8');
      assert.strictEqual(result.data.sizeBytes, expectedSize);
      
      // Verify hash is recomputed (should be different from old hash)
      assert.notStrictEqual(result.data.sha256, 'old-hash');
      assert.ok(result.data.sha256);
      assert.strictEqual(result.data.sha256.length, 64); // SHA256 hex length
    }
  });

  it('should update lastEditedAt timestamp', async () => {
    const oldTimestamp = testFile.lastEditedAt;
    
    const command = {
      projectId: 'project-1',
      path: 'main.typ',
      content: 'new content',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.ok(result.data.lastEditedAt);
      if (oldTimestamp) {
        assert.ok(result.data.lastEditedAt >= oldTimestamp);
      }
    }
  });

  it('should return PROJECT_NOT_FOUND when project does not exist', async () => {
    const command = {
      projectId: 'non-existent',
      path: 'main.typ',
      content: 'new content',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, FileErrors.PROJECT_NOT_FOUND.code);
    }
  });

  it('should return FILE_NOT_FOUND when file does not exist', async () => {
    const command = {
      projectId: 'project-1',
      path: 'non-existent.typ',
      content: 'new content',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, FileErrors.FILE_NOT_FOUND.code);
    }
  });

  it('should return UNAUTHORIZED when user is not owner', async () => {
    const command = {
      projectId: 'project-1',
      path: 'main.typ',
      content: 'new content',
      userId: 'user-456',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, FileErrors.UNAUTHORIZED.code);
    }
  });

  it('should allow admin to update file in any project', async () => {
    const command = {
      projectId: 'project-1',
      path: 'main.typ',
      content: 'admin updated content',
      userId: 'admin-456',
      userRole: 'admin' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.textContent, 'admin updated content');
    }
  });

  it('should handle empty content update', async () => {
    const command = {
      projectId: 'project-1',
      path: 'main.typ',
      content: '',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.textContent, '');
      assert.strictEqual(result.data.sizeBytes, 0);
    }
  });

  it('should handle UTF-8 content correctly', async () => {
    const utf8Content = 'Tiếng Việt có dấu 中文 日本語 🎉';
    const command = {
      projectId: 'project-1',
      path: 'main.typ',
      content: utf8Content,
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.textContent, utf8Content);
      // UTF-8 byte length should be greater than character length
      const expectedSize = Buffer.byteLength(utf8Content, 'utf8');
      assert.strictEqual(result.data.sizeBytes, expectedSize);
    }
  });
});
