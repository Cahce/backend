/**
 * Unit Tests for DeleteProjectUseCase
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { DeleteProjectUseCase } from '../application/DeleteProjectUseCase.js';
import { MockProjectRepo } from './mocks/MockProjectRepo.js';
import { TemplateCategory, type Project } from '../domain/Project/Types.js';
import { ProjectErrors } from '../domain/Project/Errors.js';

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

    // Verify project was deleted
    const deletedProject = await mockRepo.findById('project-1');
    assert.strictEqual(deletedProject, null);
  });

  it('should allow admin to delete any project', async () => {
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
      userId: 'admin-456',
      userRole: 'admin' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);

    // Verify project was deleted
    const deletedProject = await mockRepo.findById('project-1');
    assert.strictEqual(deletedProject, null);
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

    // Verify project was NOT deleted
    const project2 = await mockRepo.findById('project-1');
    assert.notStrictEqual(project2, null);
  });

  it('should deny teacher from deleting another teacher project', async () => {
    const project: Project = {
      id: 'project-1',
      title: 'Teacher Project',
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

  it('should allow teacher to delete their own project', async () => {
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

    // Verify project was deleted
    const deletedProject = await mockRepo.findById('project-1');
    assert.strictEqual(deletedProject, null);
  });
});
