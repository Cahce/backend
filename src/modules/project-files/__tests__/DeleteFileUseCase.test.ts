/**
 * Unit Tests for DeleteFileUseCase
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { DeleteFileUseCase } from '../application/DeleteFileUseCase.js';
import { MockFileRepo } from './mocks/MockFileRepo.js';
import { MockProjectRepo } from './mocks/MockProjectRepo.js';
import { FileKind, StorageMode, type File } from '../domain/ProjectFile/Types.js';
import { FileErrors } from '../domain/ProjectFile/Errors.js';
import { TemplateCategory, type Project } from '../../projects/domain/Project/Types.js';

describe('DeleteFileUseCase', () => {
  let useCase: DeleteFileUseCase;
  let mockFileRepo: MockFileRepo;
  let mockProjectRepo: MockProjectRepo;
  let testProject: Project;
  let testFile: File;

  beforeEach(() => {
    mockFileRepo = new MockFileRepo();
    mockProjectRepo = new MockProjectRepo();
    useCase = new DeleteFileUseCase(mockFileRepo, mockProjectRepo);

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

  it('should delete file successfully', async () => {
    const command = {
      projectId: 'project-1',
      path: 'main.typ',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    
    // Verify file is deleted
    const files = await mockFileRepo.listByProjectId('project-1');
    assert.strictEqual(files.length, 0);
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

  it('should allow admin to delete file in any project', async () => {
    const command = {
      projectId: 'project-1',
      path: 'main.typ',
      userId: 'admin-456',
      userRole: 'admin' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    
    // Verify file is deleted
    const files = await mockFileRepo.listByProjectId('project-1');
    assert.strictEqual(files.length, 0);
  });

  it('should not affect other files when deleting one file', async () => {
    const otherFile: File = {
      id: 'file-2',
      projectId: 'project-1',
      path: 'other.typ',
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
    mockFileRepo.setFiles([testFile, otherFile]);

    const command = {
      projectId: 'project-1',
      path: 'main.typ',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    
    // Verify only target file is deleted
    const files = await mockFileRepo.listByProjectId('project-1');
    assert.strictEqual(files.length, 1);
    assert.strictEqual(files[0].path, 'other.typ');
  });

  it('should allow teacher to delete file in own project', async () => {
    testProject.ownerId = 'teacher-123';
    mockProjectRepo.setProjects([testProject]);

    const command = {
      projectId: 'project-1',
      path: 'main.typ',
      userId: 'teacher-123',
      userRole: 'teacher' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
  });

  it('should deny teacher from deleting file in other teacher project', async () => {
    testProject.ownerId = 'teacher-999';
    mockProjectRepo.setProjects([testProject]);

    const command = {
      projectId: 'project-1',
      path: 'main.typ',
      userId: 'teacher-123',
      userRole: 'teacher' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, FileErrors.UNAUTHORIZED.code);
    }
  });
});
