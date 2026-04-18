/**
 * Unit Tests for UpdateProjectUseCase
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { UpdateProjectUseCase } from '../application/UpdateProjectUseCase.js';
import { MockProjectRepo } from './mocks/MockProjectRepo.js';
import { TemplateCategory, type Project } from '../domain/Project/Types.js';
import { ProjectErrors } from '../domain/Project/Errors.js';

describe('UpdateProjectUseCase', () => {
  let useCase: UpdateProjectUseCase;
  let mockRepo: MockProjectRepo;

  beforeEach(() => {
    mockRepo = new MockProjectRepo();
    useCase = new UpdateProjectUseCase(mockRepo);
  });

  it('should update project title successfully when user is owner', async () => {
    const project: Project = {
      id: 'project-1',
      title: 'Old Title',
      category: TemplateCategory.Thesis,
      ownerId: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastEditedAt: null,
    };
    mockRepo.setProjects([project]);

    const command = {
      projectId: 'project-1',
      title: 'New Title',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.title, 'New Title');
      assert.strictEqual(result.data.category, TemplateCategory.Thesis);
    }
  });

  it('should update project category successfully', async () => {
    const project: Project = {
      id: 'project-1',
      title: 'My Project',
      category: TemplateCategory.Thesis,
      ownerId: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastEditedAt: null,
    };
    mockRepo.setProjects([project]);

    const command = {
      projectId: 'project-1',
      category: TemplateCategory.Report,
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.category, TemplateCategory.Report);
      assert.strictEqual(result.data.title, 'My Project');
    }
  });

  it('should update both title and category', async () => {
    const project: Project = {
      id: 'project-1',
      title: 'Old Title',
      category: TemplateCategory.Thesis,
      ownerId: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastEditedAt: null,
    };
    mockRepo.setProjects([project]);

    const command = {
      projectId: 'project-1',
      title: 'New Title',
      category: TemplateCategory.Report,
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.title, 'New Title');
      assert.strictEqual(result.data.category, TemplateCategory.Report);
    }
  });

  it('should trim whitespace from title', async () => {
    const project: Project = {
      id: 'project-1',
      title: 'Old Title',
      category: TemplateCategory.Thesis,
      ownerId: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastEditedAt: null,
    };
    mockRepo.setProjects([project]);

    const command = {
      projectId: 'project-1',
      title: '  New Title  ',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.title, 'New Title');
    }
  });

  it('should return PROJECT_NOT_FOUND when project does not exist', async () => {
    const command = {
      projectId: 'non-existent',
      title: 'New Title',
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
      createdAt: new Date(),
      updatedAt: new Date(),
      lastEditedAt: null,
    };
    mockRepo.setProjects([project]);

    const command = {
      projectId: 'project-1',
      title: 'Hacked Title',
      userId: 'user-456',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, ProjectErrors.UNAUTHORIZED.code);
    }
  });

  it('should allow admin to update any project', async () => {
    const project: Project = {
      id: 'project-1',
      title: 'User Project',
      category: TemplateCategory.Thesis,
      ownerId: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastEditedAt: null,
    };
    mockRepo.setProjects([project]);

    const command = {
      projectId: 'project-1',
      title: 'Admin Updated',
      userId: 'admin-456',
      userRole: 'admin' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.title, 'Admin Updated');
    }
  });

  it('should reject empty title', async () => {
    const project: Project = {
      id: 'project-1',
      title: 'Old Title',
      category: TemplateCategory.Thesis,
      ownerId: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastEditedAt: null,
    };
    mockRepo.setProjects([project]);

    const command = {
      projectId: 'project-1',
      title: '',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, ProjectErrors.VALIDATION_ERROR.code);
    }
  });

  it('should reject whitespace-only title', async () => {
    const project: Project = {
      id: 'project-1',
      title: 'Old Title',
      category: TemplateCategory.Thesis,
      ownerId: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastEditedAt: null,
    };
    mockRepo.setProjects([project]);

    const command = {
      projectId: 'project-1',
      title: '   ',
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, ProjectErrors.VALIDATION_ERROR.code);
    }
  });
});
