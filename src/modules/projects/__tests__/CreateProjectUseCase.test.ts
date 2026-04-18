/**
 * Unit Tests for CreateProjectUseCase
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { CreateProjectUseCase } from '../application/CreateProjectUseCase.js';
import { MockProjectRepo } from './mocks/MockProjectRepo.js';
import { TemplateCategory } from '../domain/Project/Types.js';
import { ProjectErrors } from '../domain/Project/Errors.js';

describe('CreateProjectUseCase', () => {
  let useCase: CreateProjectUseCase;
  let mockRepo: MockProjectRepo;

  beforeEach(() => {
    mockRepo = new MockProjectRepo();
    useCase = new CreateProjectUseCase(mockRepo);
  });

  it('should create a project successfully with valid data', async () => {
    const command = {
      title: 'My Thesis',
      category: TemplateCategory.Thesis,
      userId: 'user-123',
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.title, 'My Thesis');
      assert.strictEqual(result.data.category, TemplateCategory.Thesis);
      assert.strictEqual(result.data.ownerId, 'user-123');
      assert.ok(result.data.id);
      assert.ok(result.data.createdAt);
      assert.ok(result.data.updatedAt);
    }
  });

  it('should trim whitespace from title', async () => {
    const command = {
      title: '  My Thesis  ',
      category: TemplateCategory.Thesis,
      userId: 'user-123',
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.title, 'My Thesis');
    }
  });

  it('should reject empty title', async () => {
    const command = {
      title: '',
      category: TemplateCategory.Thesis,
      userId: 'user-123',
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, ProjectErrors.VALIDATION_ERROR.code);
      assert.ok(result.error.message.includes('trống'));
    }
  });

  it('should reject whitespace-only title', async () => {
    const command = {
      title: '   ',
      category: TemplateCategory.Thesis,
      userId: 'user-123',
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, ProjectErrors.VALIDATION_ERROR.code);
    }
  });

  it('should create projects with different categories', async () => {
    const categories = [
      TemplateCategory.Thesis,
      TemplateCategory.Report,
      TemplateCategory.Proposal,
      TemplateCategory.Paper,
      TemplateCategory.Presentation,
      TemplateCategory.Other,
    ];

    for (const category of categories) {
      const command = {
        title: `Project ${category}`,
        category,
        userId: 'user-123',
      };

      const result = await useCase.execute(command);

      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.category, category);
      }
    }
  });
});
