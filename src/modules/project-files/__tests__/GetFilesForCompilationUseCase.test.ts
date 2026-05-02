/**
 * Unit Tests for GetFilesForCompilationUseCase
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { GetFilesForCompilationUseCase } from '../application/GetFilesForCompilationUseCase.js';
import { MockFileRepo } from './mocks/MockFileRepo.js';
import { MockProjectRepo } from './mocks/MockProjectRepo.js';
import { FileKind, StorageMode, type File } from '../domain/ProjectFile/Types.js';
import { FileErrors } from '../domain/ProjectFile/Errors.js';
import { TemplateCategory, type Project } from '../../projects/domain/Project/Types.js';

describe('GetFilesForCompilationUseCase', () => {
  let useCase: GetFilesForCompilationUseCase;
  let mockFileRepo: MockFileRepo;
  let mockProjectRepo: MockProjectRepo;
  let testProject: Project;

  beforeEach(() => {
    mockFileRepo = new MockFileRepo();
    mockProjectRepo = new MockProjectRepo();
    useCase = new GetFilesForCompilationUseCase(mockFileRepo, mockProjectRepo);

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

  it('should retrieve all compilation-relevant files', async () => {
    const files: File[] = [
      {
        id: 'file-1',
        projectId: 'project-1',
        path: 'main.typ',
        kind: FileKind.Typst,
        storageMode: StorageMode.Inline,
        textContent: 'typst content',
        storageKey: null,
        mimeType: 'text/plain',
        sizeBytes: 13,
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
        textContent: 'bib content',
        storageKey: null,
        mimeType: 'text/plain',
        sizeBytes: 11,
        sha256: 'hash2',
        lastEditedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'file-3',
        projectId: 'project-1',
        path: 'image.png',
        kind: FileKind.Image,
        storageMode: StorageMode.Inline,
        textContent: null,
        storageKey: 'storage-key-3',
        mimeType: 'image/png',
        sizeBytes: 1024,
        sha256: 'hash3',
        lastEditedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'file-4',
        projectId: 'project-1',
        path: 'data.csv',
        kind: FileKind.Data,
        storageMode: StorageMode.Inline,
        textContent: 'csv data',
        storageKey: null,
        mimeType: 'text/csv',
        sizeBytes: 8,
        sha256: 'hash4',
        lastEditedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'file-5',
        projectId: 'project-1',
        path: 'readme.md',
        kind: FileKind.Other,
        storageMode: StorageMode.Inline,
        textContent: 'readme',
        storageKey: null,
        mimeType: 'text/markdown',
        sizeBytes: 6,
        sha256: 'hash5',
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
      // Should include typst, bib, image, data but exclude other
      assert.strictEqual(result.data.length, 4);
      const kinds = result.data.map(f => f.kind);
      assert.ok(kinds.includes(FileKind.Typst));
      assert.ok(kinds.includes(FileKind.Bib));
      assert.ok(kinds.includes(FileKind.Image));
      assert.ok(kinds.includes(FileKind.Data));
      assert.ok(!kinds.includes(FileKind.Other));
    }
  });

  it('should include only typst files when no other compilation files exist', async () => {
    const files: File[] = [
      {
        id: 'file-1',
        projectId: 'project-1',
        path: 'main.typ',
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
      assert.strictEqual(result.data.length, 1);
      assert.strictEqual(result.data[0].kind, FileKind.Typst);
    }
  });

  it('should return empty array when no compilation files exist', async () => {
    const files: File[] = [
      {
        id: 'file-1',
        projectId: 'project-1',
        path: 'readme.md',
        kind: FileKind.Other,
        storageMode: StorageMode.Inline,
        textContent: 'readme',
        storageKey: null,
        mimeType: 'text/markdown',
        sizeBytes: 6,
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

  it('should allow admin to get compilation files from any project', async () => {
    const files: File[] = [
      {
        id: 'file-1',
        projectId: 'project-1',
        path: 'main.typ',
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
      },
    ];
    mockFileRepo.setFiles(files);

    const command = {
      projectId: 'project-1',
      userId: 'admin-456',
      userRole: 'admin' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.length, 1);
    }
  });

  it('should include full file content for compilation', async () => {
    const files: File[] = [
      {
        id: 'file-1',
        projectId: 'project-1',
        path: 'main.typ',
        kind: FileKind.Typst,
        storageMode: StorageMode.Inline,
        textContent: 'full typst content for compilation',
        storageKey: null,
        mimeType: 'text/plain',
        sizeBytes: 34,
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
      assert.strictEqual(result.data[0].textContent, 'full typst content for compilation');
    }
  });
});
