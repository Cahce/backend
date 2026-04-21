/**
 * Unit Tests for GetFileUseCase
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { GetFileUseCase } from '../application/GetFileUseCase.js';
import { MockFileRepo } from './mocks/MockFileRepo.js';
import { MockProjectRepo } from './mocks/MockProjectRepo.js';
import { FileKind, StorageMode, type File } from '../domain/ProjectFile/Types.js';
import { FileErrors } from '../domain/ProjectFile/Errors.js';
import { TemplateCategory, type Project } from '../../projects/domain/Project/Types.js';

describe('GetFileUseCase', () => {
  let useCase: GetFileUseCase;
  let mockFileRepo: MockFileRepo;
  let mockProjectRepo: MockProjectRepo;
  let testProject: Project;
  let testFile: File;

  beforeEach(() => {
    mockFileRepo = new MockFileRepo();
    mockProjectRepo = new MockProjectRepo();
    useCase = new GetFileUseCase(mockFileRepo, mockProjectRepo);

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
      textContent: '#heading[My Document]',
      storageKey: null,
      mimeType: 'text/plain',
      sizeBytes: 23,
      sha256: 'hash123',
      lastEditedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockFileRepo.setFiles([testFile]);
  });

  it('should retrieve file successfully when user is owner', async () => {
    const command = {
      projectId: 'project-1',
      path: 'main.typ',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.id, 'file-1');
      assert.strictEqual(result.data.path, 'main.typ');
      assert.strictEqual(result.data.textContent, '#heading[My Document]');
    }
  });

  it('should retrieve file successfully when user is admin', async () => {
    const command = {
      projectId: 'project-1',
      path: 'main.typ',
      userId: 'admin-456',
      userRole: 'admin' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
  });

  it('should return PROJECT_NOT_FOUND when project does not exist', async () => {
    const command = {
      projectId: 'non-existent',
      path: 'main.typ',
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
      userId: 'user-456',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, FileErrors.UNAUTHORIZED.code);
    }
  });

  it('should include full content in response', async () => {
    const command = {
      projectId: 'project-1',
      path: 'main.typ',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.ok(result.data.textContent);
      assert.ok(result.data.sizeBytes);
      assert.ok(result.data.sha256);
    }
  });
});
