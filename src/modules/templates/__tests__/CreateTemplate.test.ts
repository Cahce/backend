/**
 * Unit Tests for CreateTemplateUseCase
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { CreateTemplateUseCase } from '../application/CreateTemplateUseCase.js';
import { MockTemplateRepo } from './mocks/MockTemplateRepo.js';
import { TemplateCategory } from '../domain/Types.js';
import { TemplateErrors } from '../domain/Errors.js';

describe('CreateTemplateUseCase', () => {
  let useCase: CreateTemplateUseCase;
  let mockRepo: MockTemplateRepo;

  beforeEach(() => {
    mockRepo = new MockTemplateRepo();
    useCase = new CreateTemplateUseCase(mockRepo);
  });

  it('should create a template successfully with valid data', async () => {
    const input = {
      name: 'Thesis Template',
      description: 'Official thesis template',
      category: TemplateCategory.Thesis,
      isOfficial: true,
    };

    const result = await useCase.execute(input);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.name, 'Thesis Template');
      assert.strictEqual(result.data.description, 'Official thesis template');
      assert.strictEqual(result.data.category, TemplateCategory.Thesis);
      assert.strictEqual(result.data.isOfficial, true);
      assert.strictEqual(result.data.isActive, true);
      assert.ok(result.data.id);
      assert.ok(result.data.createdAt);
      assert.ok(result.data.updatedAt);
    }
  });

  it('should create template with null description', async () => {
    const input = {
      name: 'Simple Template',
      description: null,
      category: TemplateCategory.Report,
      isOfficial: false,
    };

    const result = await useCase.execute(input);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.name, 'Simple Template');
      assert.strictEqual(result.data.description, null);
      assert.strictEqual(result.data.isOfficial, false);
    }
  });

  it('should reject empty name', async () => {
    const input = {
      name: '',
      description: 'Test',
      category: TemplateCategory.Thesis,
      isOfficial: false,
    };

    const result = await useCase.execute(input);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, TemplateErrors.VALIDATION_ERROR.code);
    }
  });

  it('should reject whitespace-only name', async () => {
    const input = {
      name: '   ',
      description: 'Test',
      category: TemplateCategory.Thesis,
      isOfficial: false,
    };

    const result = await useCase.execute(input);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, TemplateErrors.VALIDATION_ERROR.code);
    }
  });

  it('should create templates with different categories', async () => {
    const categories = [
      TemplateCategory.Thesis,
      TemplateCategory.Report,
      TemplateCategory.Proposal,
      TemplateCategory.Paper,
      TemplateCategory.Presentation,
      TemplateCategory.Other,
    ];

    for (const category of categories) {
      const input = {
        name: `Template ${category}`,
        description: null,
        category,
        isOfficial: false,
      };

      const result = await useCase.execute(input);

      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.category, category);
      }
    }
  });

  it('should create both official and non-official templates', async () => {
    const input1 = {
      name: 'Official Template',
      description: null,
      category: TemplateCategory.Thesis,
      isOfficial: true,
    };

    const result1 = await useCase.execute(input1);
    assert.strictEqual(result1.success, true);
    if (result1.success) {
      assert.strictEqual(result1.data.isOfficial, true);
    }

    const input2 = {
      name: 'User Template',
      description: null,
      category: TemplateCategory.Thesis,
      isOfficial: false,
    };

    const result2 = await useCase.execute(input2);
    assert.strictEqual(result2.success, true);
    if (result2.success) {
      assert.strictEqual(result2.data.isOfficial, false);
    }
  });
});
