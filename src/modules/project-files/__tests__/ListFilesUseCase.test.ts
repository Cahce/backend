/**
 * Unit Tests for ListFilesUseCase
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ListFilesUseCase } from '../application/ListFilesUseCase.js';
import { MockFileRepo } from './mocks/MockFileRepo.js';
import { MockProjectRepo } from './mocks/MockProjectRepo.js';
import { FileKind, StorageMode, type File } from '../domain/ProjectFile/Types.js';
import { FileErrors } from '../domain/ProjectFile/Errors.js';
import { TemplateCategory, type Project } from '../../projects/domain/Project/Types.js';

describe('ListFilesUseCase', () => {
  let useCase: ListFilesUseCase;
  let mockFileRepo: MockFileRepo;
  let mockProjectRepo: MockProjectRepo;
  let testProject: Project;

  beforeEach(() => {
    mockFileRepo = new MockFileRepo();
    mockProjectRepo = new MockProjectRepo();
    useCase = new ListFilesUseCase(mockFileRepo, mockProjectRepo);

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

  it('should list all files in project', async () => {
    const files: File[] = [
      {
        id: 'file-1',
        projectId: 'project-1',
        path: 'main.typ',
        kind: FileKind.Typst,
        storageMode: StorageMode.Inline,
        textContent: 'content1',
        storageKey: null,
        mimeType: 'text/plain',
        sizeBytes: 8,
        sha256: 'hash1',
        lastEditedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'file-2',
        projectId: 'project-1',
        path: 'refs.bib',
        kind: FileKind.Bib,
        storageMode: StorageMode.Inline,
        textContent: 'content2',
        storageKey: null,
        mimeType: 'text/plain',
        sizeBytes: 8,
        sha256: 'hash2',
        lastEditedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    mockFileRepo.setFiles(files);

    const command = {
      projectId: 'project-1',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.length, 2);
    }
  });

  it('should return files ordered by path alphabetically', async () => {
    const files: File[] = [
      {
        id: 'file-1',
        projectId: 'project-1',
        path: 'z-last.typ',
        kind: FileKind.Typst,
        storageMode: StorageMode.Inline,
        textContent: 'content',
        storageKey: null,
        mimeType: null,
        sizeBytes: 7,
        sha256: 'hash',
        lastEditedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'file-2',
        projectId: 'project-1',
        path: 'a-first.typ',
        kind: FileKind.Typst,
        storageMode: StorageMode.Inline,
        textContent: 'content',
        storageKey: null,
        mimeType: null,
        sizeBytes: 7,
        sha256: 'hash',
        lastEditedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    mockFileRepo.setFiles(files);

    const command = {
      projectId: 'project-1',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data[0].path, 'a-first.typ');
      assert.strictEqual(result.data[1].path, 'z-last.typ');
    }
  });

  it('should exclude textContent and storageKey from response', async () => {
    const files: File[] = [
      {
        id: 'file-1',
        projectId: 'project-1',
        path: 'main.typ',
        kind: FileKind.Typst,
        storageMode: StorageMode.Inline,
        textContent: 'secret content',
        storageKey: null,
        mimeType: 'text/plain',
        sizeBytes: 14,
        sha256: 'hash',
        lastEditedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    mockFileRepo.setFiles(files);

    const command = {
      projectId: 'project-1',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      const file = result.data[0];
      assert.strictEqual('textContent' in file, false);
      assert.strictEqual('storageKey' in file, false);
      assert.ok(file.id);
      assert.ok(file.path);
      assert.ok(file.kind);
    }
  });

  it('should return empty list when project has no files', async () => {
    const command = {
      projectId: 'project-1',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.length, 0);
    }
  });

  it('should return PROJECT_NOT_FOUND when project does not exist', async () => {
    const command = {
      projectId: 'non-existent',
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
      userId: 'user-456',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, FileErrors.UNAUTHORIZED.code);
    }
  });

  it('should allow admin to list files in any project', async () => {
    const command = {
      projectId: 'project-1',
      userId: 'admin-456',
      userRole: 'admin' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
  });
});
