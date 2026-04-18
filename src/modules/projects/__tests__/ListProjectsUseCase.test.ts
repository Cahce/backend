/**
 * Unit Tests for ListProjectsUseCase
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ListProjectsUseCase } from '../application/ListProjectsUseCase.js';
import { MockProjectRepo } from './mocks/MockProjectRepo.js';
import { TemplateCategory, type Project } from '../domain/Project/Types.js';

describe('ListProjectsUseCase', () => {
  let useCase: ListProjectsUseCase;
  let mockRepo: MockProjectRepo;

  beforeEach(() => {
    mockRepo = new MockProjectRepo();
    useCase = new ListProjectsUseCase(mockRepo);
  });

  it('should list all projects owned by user', async () => {
    const projects: Project[] = [
      {
        id: 'project-1',
        title: 'Thesis',
        category: TemplateCategory.Thesis,
        ownerId: 'user-123',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-03'),
        lastEditedAt: null,
      },
      {
        id: 'project-2',
        title: 'Report',
        category: TemplateCategory.Report,
        ownerId: 'user-123',
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-04'),
        lastEditedAt: null,
      },
      {
        id: 'project-3',
        title: 'Other User Project',
        category: TemplateCategory.Paper,
        ownerId: 'user-456',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-05'),
        lastEditedAt: null,
      },
    ];
    mockRepo.setProjects(projects);

    const command = {
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.length, 2);
      assert.strictEqual(result.data[0].ownerId, 'user-123');
      assert.strictEqual(result.data[1].ownerId, 'user-123');
    }
  });

  it('should return projects ordered by updatedAt descending', async () => {
    const projects: Project[] = [
      {
        id: 'project-1',
        title: 'Oldest',
        category: TemplateCategory.Thesis,
        ownerId: 'user-123',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        lastEditedAt: null,
      },
      {
        id: 'project-2',
        title: 'Newest',
        category: TemplateCategory.Report,
        ownerId: 'user-123',
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-03'),
        lastEditedAt: null,
      },
      {
        id: 'project-3',
        title: 'Middle',
        category: TemplateCategory.Paper,
        ownerId: 'user-123',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        lastEditedAt: null,
      },
    ];
    mockRepo.setProjects(projects);

    const command = {
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.length, 3);
      assert.strictEqual(result.data[0].title, 'Newest');
      assert.strictEqual(result.data[1].title, 'Middle');
      assert.strictEqual(result.data[2].title, 'Oldest');
    }
  });

  it('should return empty list when user has no projects', async () => {
    const projects: Project[] = [
      {
        id: 'project-1',
        title: 'Other User Project',
        category: TemplateCategory.Thesis,
        ownerId: 'user-456',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastEditedAt: null,
      },
    ];
    mockRepo.setProjects(projects);

    const command = {
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.length, 0);
    }
  });

  it('should return empty list when no projects exist', async () => {
    const command = {
      userId: 'user-123',
      userRole: 'student' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.length, 0);
    }
  });

  it('should work for teachers', async () => {
    const projects: Project[] = [
      {
        id: 'project-1',
        title: 'Teacher Project',
        category: TemplateCategory.Paper,
        ownerId: 'teacher-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastEditedAt: null,
      },
    ];
    mockRepo.setProjects(projects);

    const command = {
      userId: 'teacher-123',
      userRole: 'teacher' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.length, 1);
      assert.strictEqual(result.data[0].title, 'Teacher Project');
    }
  });

  it('should work for admins', async () => {
    const projects: Project[] = [
      {
        id: 'project-1',
        title: 'Admin Project',
        category: TemplateCategory.Other,
        ownerId: 'admin-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastEditedAt: null,
      },
    ];
    mockRepo.setProjects(projects);

    const command = {
      userId: 'admin-123',
      userRole: 'admin' as const,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.length, 1);
    }
  });
});
