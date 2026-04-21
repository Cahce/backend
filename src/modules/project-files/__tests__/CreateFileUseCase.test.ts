/**
 * Unit Tests for CreateFileUseCase
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { CreateFileUseCase } from '../application/CreateFileUseCase.js';
import { MockFileRepo } from './mocks/MockFileRepo.js';
import { MockProjectRepo } from './mocks/MockProjectRepo.js';
import { FileKind, StorageMode, type File } from '../domain/ProjectFile/Types.js';
import { FileErrors } from '../domain/ProjectFile/Errors.js';
import { TemplateCategory, type Project } from '../../projects/domain/Project/Types.js';

describe('CreateFileUseCase', () => {
  let useCase: CreateFileUseCase;
  let mockFileRepo: MockFileRepo;
  let mockProjectRepo: MockProjectRepo;
  let testProject: Project;

  beforeEach(() => {
    mockFileRepo = new MockFileRepo();
    mockProjectRepo = new MockProjectRepo();
    useCase = new CreateFileUseCase(mockFileRepo, mockProjectRepo);

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
  });

  it('should create a file successfully with valid data', async () => {
    const command = {
      projectId: 'project-1',
      path: 'main.typ',
      kind: FileKind.Typst,
      content: '#heading[My Document]',
      mimeType: 'text/plain',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.path, 'main.typ');
      assert.strictEqual(result.data.kind, FileKind.Typst);
      assert.strictEqual(result.data.projectId, 'project-1');
      assert.strictEqual(result.data.storageMode, StorageMode.Inline);
      assert.ok(result.data.sizeBytes);
      assert.ok(result.data.sha256);
      assert.ok(result.data.lastEditedAt);
    }
  });

  it('should compute correct size and hash', async () => {
    const content = 'Hello World';
    const command = {
      projectId: 'project-1',
      path: 'test.typ',
      kind: FileKind.Typst,
      content,
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.sizeBytes, Buffer.byteLength(content, 'utf8'));
      assert.ok(result.data.sha256);
      assert.strictEqual(result.data.sha256!.length, 64); // SHA-256 hex length
    }
  });

  it('should return PROJECT_NOT_FOUND when project does not exist', async () => {
    const command = {
      projectId: 'non-existent',
      path: 'main.typ',
      kind: FileKind.Typst,
      content: 'content',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, FileErrors.PROJECT_NOT_FOUND.code);
    }
  });

  it('should return UNAUTHORIZED when user is not owner', async () => {
    const command = {
      projectId: 'project-1',
      path: 'main.typ',
      kind: FileKind.Typst,
      content: 'content',
      userId: 'user-456', // Different user
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, FileErrors.UNAUTHORIZED.code);
    }
  });

  it('should allow admin to create file in any project', async () => {
    const command = {
      projectId: 'project-1',
      path: 'main.typ',
      kind: FileKind.Typst,
      content: 'content',
      userId: 'admin-456',
      userRole: 'admin' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
  });

  it('should return FILE_ALREADY_EXISTS when file exists at path', async () => {
    const existingFile: File = {
      id: 'file-1',
      projectId: 'project-1',
      path: 'main.typ',
      kind: FileKind.Typst,
      storageMode: StorageMode.Inline,
      textContent: 'existing',
      storageKey: null,
      mimeType: 'text/plain',
      sizeBytes: 8,
      sha256: 'hash',
      lastEditedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockFileRepo.setFiles([existingFile]);

    const command = {
      projectId: 'project-1',
      path: 'main.typ',
      kind: FileKind.Typst,
      content: 'new content',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, FileErrors.FILE_ALREADY_EXISTS.code);
    }
  });

  it('should reject path with ../', async () => {
    const command = {
      projectId: 'project-1',
      path: '../etc/passwd',
      kind: FileKind.Other,
      content: 'malicious',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, FileErrors.INVALID_FILE_PATH.code);
      assert.ok(result.error.message.includes('../'));
    }
  });

  it('should reject path starting with ./', async () => {
    const command = {
      projectId: 'project-1',
      path: './main.typ',
      kind: FileKind.Typst,
      content: 'content',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, FileErrors.INVALID_FILE_PATH.code);
    }
  });

  it('should reject absolute path', async () => {
    const command = {
      projectId: 'project-1',
      path: '/etc/passwd',
      kind: FileKind.Other,
      content: 'malicious',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, FileErrors.INVALID_FILE_PATH.code);
    }
  });

  it('should reject empty path', async () => {
    const command = {
      projectId: 'project-1',
      path: '',
      kind: FileKind.Typst,
      content: 'content',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, FileErrors.INVALID_FILE_PATH.code);
    }
  });

  it('should create files with different kinds', async () => {
    const kinds = [
      FileKind.Typst,
      FileKind.Bib,
      FileKind.Image,
      FileKind.Data,
      FileKind.Other,
    ];

    for (const kind of kinds) {
      mockFileRepo.clear();
      const command = {
        projectId: 'project-1',
        path: `file.${kind}`,
        kind,
        content: 'content',
        userId: 'user-123',
        userRole: 'student' as const,
      };

      const result = await useCase.execute(command);

      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.kind, kind);
      }
    }
  });

  it('should apply storage policy (inline for Stage 1)', async () => {
    const command = {
      projectId: 'project-1',
      path: 'main.typ',
      kind: FileKind.Typst,
      content: 'content',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.storageMode, StorageMode.Inline);
      assert.ok(result.data.textContent);
      assert.strictEqual(result.data.storageKey, null);
    }
  });
});
