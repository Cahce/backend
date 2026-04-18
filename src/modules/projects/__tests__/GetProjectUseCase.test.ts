/**
 * Unit Tests for GetProjectUseCase
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { GetProjectUseCase } from '../application/GetProjectUseCase.js';
import { MockProjectRepo } from './mocks/MockProjectRepo.js';
import { TemplateCategory, type Project } from '../domain/Project/Types.js';
import { ProjectErrors } from '../domain/Project/Errors.js';

describe('GetProjectUseCase', () => {
  let useCase: GetProjectUseCase;
  let mockRepo: MockProjectRepo;

  beforeEach(() => {
    mockRepo = new MockProjectRepo();
    useCase = new GetProjectUseCase(mockRepo);
  });

  it('should retrieve a project successfully when user is owner', async () => {
    const project: Project = {
      id: 'project-1',
      title: 'My Thesis',
      category: TemplateCategory.Thesis,
      ownerId: 'user-123',
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
    if (result.success) {
      assert.strictEqual(result.data.id, 'project-1');
      assert.strictEqual(result.data.title, 'My Thesis');
      assert.strictEqual(result.data.ownerId, 'user-123');
    }
  });

  it('should retrieve a project successfully when user is admin', async () => {
    const project: Project = {
      id: 'project-1',
      title: 'My Thesis',
      category: TemplateCategory.Thesis,
      ownerId: 'user-123',
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

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.id, 'project-1');
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
      assert.strictEqual(result.error.code, ProjectErrors.PROJECT_NOT_FOUND.code);
      assert.strictEqual(result.error.message, ProjectErrors.PROJECT_NOT_FOUND.message);
    }
  });

  it('should return UNAUTHORIZED when user is not owner and not admin', async () => {
    const project: Project = {
      id: 'project-1',
      title: 'My Thesis',
      category: TemplateCategory.Thesis,
      ownerId: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastEditedAt: null,
    };
    mockRepo.setProjects([project]);

    const command = {
      projectId: 'project-1',
      userId: 'user-456', // Different user
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, ProjectErrors.UNAUTHORIZED.code);
      assert.strictEqual(result.error.message, ProjectErrors.UNAUTHORIZED.message);
    }
  });

  it('should allow teacher to access their own project', async () => {
    const project: Project = {
      id: 'project-1',
      title: 'My Research',
      category: TemplateCategory.Paper,
      ownerId: 'teacher-123',
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
  });

  it('should deny teacher access to another teacher project', async () => {
    const project: Project = {
      id: 'project-1',
      title: 'My Research',
      category: TemplateCategory.Paper,
      ownerId: 'teacher-123',
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
});
