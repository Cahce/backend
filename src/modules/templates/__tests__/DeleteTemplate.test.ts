/**
 * Unit Tests for DeleteTemplateUseCase
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { DeleteTemplateUseCase } from '../application/DeleteTemplateUseCase.js';
import { MockTemplateRepo } from './mocks/MockTemplateRepo.js';
import { TemplateCategory, type Template } from '../domain/Types.js';
import { TemplateErrors } from '../domain/Errors.js';

describe('DeleteTemplateUseCase', () => {
  let useCase: DeleteTemplateUseCase;
  let mockRepo: MockTemplateRepo;

  beforeEach(() => {
    mockRepo = new MockTemplateRepo();
    useCase = new DeleteTemplateUseCase(mockRepo);
  });

  it('should delete template successfully when not in use', async () => {
    const template: Template = {
      id: 'template-1',
      name: 'Test Template',
      description: null,
      category: TemplateCategory.Thesis,
      isOfficial: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockRepo.setTemplates([template]);
    mockRepo.setProjectUsageCount('template-1', 0);

    const result = await useCase.execute('template-1');

    assert.strictEqual(result.success, true);

    // Verify template was deleted
    const deletedTemplate = await mockRepo.findById('template-1');
    assert.strictEqual(deletedTemplate, null);
  });

  it('should return TEMPLATE_NOT_FOUND when template does not exist', async () => {
    const result = await useCase.execute('non-existent');

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, TemplateErrors.TEMPLATE_NOT_FOUND.code);
      assert.ok(result.error.message.includes('Không tìm thấy'));
    }
  });

  it('should return TEMPLATE_IN_USE when template is used by projects', async () => {
    const template: Template = {
      id: 'template-1',
      name: 'Popular Template',
      description: null,
      category: TemplateCategory.Thesis,
      isOfficial: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockRepo.setTemplates([template]);
    mockRepo.setProjectUsageCount('template-1', 5);

    const result = await useCase.execute('template-1');

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, TemplateErrors.TEMPLATE_IN_USE.code);
      assert.ok(result.error.message.includes('đang được sử dụng'));
    }

    // Verify template was NOT deleted
    const template2 = await mockRepo.findById('template-1');
    assert.notStrictEqual(template2, null);
  });

  it('should prevent deletion when even one project uses the template', async () => {
    const template: Template = {
      id: 'template-1',
      name: 'Template',
      description: null,
      category: TemplateCategory.Report,
      isOfficial: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockRepo.setTemplates([template]);
    mockRepo.setProjectUsageCount('template-1', 1);

    const result = await useCase.execute('template-1');

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, TemplateErrors.TEMPLATE_IN_USE.code);
    }
  });

  it('should allow deletion of inactive template if not in use', async () => {
    const template: Template = {
      id: 'template-1',
      name: 'Inactive Template',
      description: null,
      category: TemplateCategory.Thesis,
      isOfficial: false,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockRepo.setTemplates([template]);
    mockRepo.setProjectUsageCount('template-1', 0);

    const result = await useCase.execute('template-1');

    assert.strictEqual(result.success, true);

    // Verify template was deleted
    const deletedTemplate = await mockRepo.findById('template-1');
    assert.strictEqual(deletedTemplate, null);
  });

  it('should allow deletion of official template if not in use', async () => {
    const template: Template = {
      id: 'template-1',
      name: 'Official Template',
      description: null,
      category: TemplateCategory.Thesis,
      isOfficial: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockRepo.setTemplates([template]);
    mockRepo.setProjectUsageCount('template-1', 0);

    const result = await useCase.execute('template-1');

    assert.strictEqual(result.success, true);
  });
});
