
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Readable } from 'node:stream';
import { DeleteProjectUseCase } from '../application/DeleteProjectUseCase.js';
import { MockProjectRepo } from './mocks/MockProjectRepo.js';
import { TemplateCategory, type Project } from '../domain/Project/Types.js';
import { ProjectErrors } from '../domain/Project/Errors.js';
import type { BlobMetadata, BlobStorage } from '../../../shared/storage/BlobStorage.js';

class RecordingBlobStorage implements BlobStorage {
  public readonly deleted: string[] = [];
  public failOn: string | null = null;

  async put(_key: string, _body: Readable | Buffer, contentType: string): Promise<BlobMetadata> {
    return { sizeBytes: 0, sha256: 'mock', contentType };
  }

  async get(): Promise<Readable> {
    return Readable.from(Buffer.alloc(0));
  }

  async head(): Promise<BlobMetadata | null> {
    return null;
  }

  async delete(key: string): Promise<void> {
    if (this.failOn === key) {
      throw new Error(`STORAGE_DELETE_FAILED: ${key}`);
    }
    this.deleted.push(key);
  }
}

describe('DeleteProjectUseCase', () => {
  let useCase: DeleteProjectUseCase;
  let mockRepo: MockProjectRepo;

  beforeEach(() => {
    mockRepo = new MockProjectRepo();
    useCase = new DeleteProjectUseCase(mockRepo);
  });

  it('should delete project successfully when user is owner', async () => {
    const project: Project = {
      id: 'project-1',
      title: 'My Project',
      category: TemplateCategory.Thesis,
      ownerId: 'user-123',
      templateId: null,
      templateVersionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastEditedAt: null,
    };
    mockRepo.setProjects([project]);

    const command = {
      projectId: 'project-1',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);

    const deletedProject = await mockRepo.findById('project-1');
    assert.strictEqual(deletedProject, null);
  });

  it('should deny admin deleting a project they do not own (oversight is read-only)', async () => {
    const project: Project = {
      id: 'project-1',
      title: 'User Project',
      category: TemplateCategory.Thesis,
      ownerId: 'user-123',
      templateId: null,
      templateVersionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastEditedAt: null,
    };
    mockRepo.setProjects([project]);

    const command = {
      projectId: 'project-1',
      userId: 'admin-456',
      userRole: 'admin' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, ProjectErrors.UNAUTHORIZED.code);
    }

    const stillThere = await mockRepo.findById('project-1');
    assert.notStrictEqual(stillThere, null);
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
      assert.strictEqual(result.error.code, ProjectErrors.PROJECT_NOT_FOUND.code);
    }
  });

  it('should return UNAUTHORIZED when user is not owner and not admin', async () => {
    const project: Project = {
      id: 'project-1',
      title: 'My Project',
      category: TemplateCategory.Thesis,
      ownerId: 'user-123',
      templateId: null,
      templateVersionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastEditedAt: null,
    };
    mockRepo.setProjects([project]);

    const command = {
      projectId: 'project-1',
      userId: 'user-456',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, ProjectErrors.UNAUTHORIZED.code);
    }

    const project2 = await mockRepo.findById('project-1');
    assert.notStrictEqual(project2, null);
  });

  it('should deny teacher from deleting another teacher project', async () => {
    const project: Project = {
      id: 'project-1',
      title: 'Teacher Project',
      category: TemplateCategory.Paper,
      ownerId: 'teacher-123',
      templateId: null,
      templateVersionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastEditedAt: null,
    };
    mockRepo.setProjects([project]);

    const command = {
      projectId: 'project-1',
      userId: 'teacher-456',
      userRole: 'teacher' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, ProjectErrors.UNAUTHORIZED.code);
    }
  });

  it('should allow teacher to delete their own project', async () => {
    const project: Project = {
      id: 'project-1',
      title: 'My Research',
      category: TemplateCategory.Paper,
      ownerId: 'teacher-123',
      templateId: null,
      templateVersionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastEditedAt: null,
    };
    mockRepo.setProjects([project]);

    const command = {
      projectId: 'project-1',
      userId: 'teacher-123',
      userRole: 'teacher' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);

    const deletedProject = await mockRepo.findById('project-1');
    assert.strictEqual(deletedProject, null);
  });

  it('should free File and CompileArtifact blobs when a project is deleted', async () => {
    const project: Project = {
      id: 'project-1',
      title: 'My Project',
      category: TemplateCategory.Thesis,
      ownerId: 'user-123',
      templateId: null,
      templateVersionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastEditedAt: null,
    };
    mockRepo.setProjects([project]);
    mockRepo.setStorageKeys('project-1', [
      'projects/project-1/image.png',
      'artifacts/pdf-1',
    ]);

    const storage = new RecordingBlobStorage();
    const useCaseWithStorage = new DeleteProjectUseCase(mockRepo, storage);

    const result = await useCaseWithStorage.execute({
      projectId: 'project-1',
      userId: 'user-123',
      userRole: 'student' as const,
    });

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(storage.deleted.sort(), [
      'artifacts/pdf-1',
      'projects/project-1/image.png',
    ]);
    assert.strictEqual(await mockRepo.findById('project-1'), null);
  });

  it('should still succeed when a blob delete fails (best-effort cleanup)', async () => {
    const project: Project = {
      id: 'project-1',
      title: 'My Project',
      category: TemplateCategory.Thesis,
      ownerId: 'user-123',
      templateId: null,
      templateVersionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastEditedAt: null,
    };
    mockRepo.setProjects([project]);
    mockRepo.setStorageKeys('project-1', ['missing-blob', 'projects/project-1/ok.png']);

    const storage = new RecordingBlobStorage();
    storage.failOn = 'missing-blob';
    const useCaseWithStorage = new DeleteProjectUseCase(mockRepo, storage);

    const result = await useCaseWithStorage.execute({
      projectId: 'project-1',
      userId: 'user-123',
      userRole: 'student' as const,
    });

    assert.strictEqual(result.success, true);
    // The DB delete is authoritative; the reachable blob is still cleaned up.
    assert.deepStrictEqual(storage.deleted, ['projects/project-1/ok.png']);
    assert.strictEqual(await mockRepo.findById('project-1'), null);
  });
});
