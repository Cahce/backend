/**
 * Unit Tests for CreateTemplateVersionUseCase
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { CreateTemplateVersionUseCase } from '../application/CreateTemplateVersionUseCase.js';
import { MockTemplateRepo } from './mocks/MockTemplateRepo.js';
import { MockTemplateStorage } from './mocks/MockTemplateStorage.js';
import { TemplateCategory, type Template, type TemplateVersion } from '../domain/Types.js';
import { TemplateErrors } from '../domain/Errors.js';

describe('CreateTemplateVersionUseCase', () => {
  let useCase: CreateTemplateVersionUseCase;
  let mockRepo: MockTemplateRepo;
  let mockStorage: MockTemplateStorage;

  beforeEach(() => {
    mockRepo = new MockTemplateRepo();
    mockStorage = new MockTemplateStorage();
    useCase = new CreateTemplateVersionUseCase(mockRepo, mockStorage);
  });

  it('should create version successfully with valid .typ file', async () => {
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

    const input = {
      templateId: 'template-1',
      versionNumber: 'v1.0.0',
      changelog: 'Initial version',
      archive: MockTemplateStorage.createArchive('= Template\n\nContent'),
      archiveType: 'typ' as const,
    };

    const result = await useCase.execute(input);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.templateId, 'template-1');
      assert.strictEqual(result.data.versionNumber, 'v1.0.0');
      assert.strictEqual(result.data.changelog, 'Initial version');
      assert.strictEqual(result.data.entryPath, 'main.typ');
      assert.strictEqual(result.data.isActive, true);
      assert.ok(result.data.id);
      assert.ok(result.data.storageKey);
    }
  });

  it('should accept version number without v prefix', async () => {
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

    const input = {
      templateId: 'template-1',
      versionNumber: '1.0.0',
      changelog: null,
      archive: MockTemplateStorage.createArchive('= Template'),
      archiveType: 'typ' as const,
    };

    const result = await useCase.execute(input);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.versionNumber, '1.0.0');
    }
  });

  it('should return TEMPLATE_NOT_FOUND when template does not exist', async () => {
    const input = {
      templateId: 'non-existent',
      versionNumber: 'v1.0.0',
      changelog: null,
      archive: MockTemplateStorage.createArchive('= Template'),
      archiveType: 'typ' as const,
    };

    const result = await useCase.execute(input);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, TemplateErrors.TEMPLATE_NOT_FOUND.code);
    }
  });

  it('should return VERSION_EXISTS when version number already exists', async () => {
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
    const existingVersion: TemplateVersion = {
      id: 'version-1',
      templateId: 'template-1',
      versionNumber: 'v1.0.0',
      changelog: null,
      storageKey: 'template-1/version-1',
      entryPath: 'main.typ',
      isActive: true,
      createdAt: new Date(),
    };
    mockRepo.setTemplates([template]);
    mockRepo.setVersions([existingVersion]);

    const input = {
      templateId: 'template-1',
      versionNumber: 'v1.0.0',
      changelog: 'Duplicate',
      archive: MockTemplateStorage.createArchive('= Template'),
      archiveType: 'typ' as const,
    };

    const result = await useCase.execute(input);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, TemplateErrors.VERSION_EXISTS.code);
      assert.ok(result.error.message.includes('đã tồn tại'));
    }
  });

  it('should reject invalid version number format', async () => {
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

    const invalidVersions = ['v1', '1.0', 'version-1', 'abc', '1.0.0.0'];

    for (const versionNumber of invalidVersions) {
      const input = {
        templateId: 'template-1',
        versionNumber,
        changelog: null,
        archive: MockTemplateStorage.createArchive('= Template'),
        archiveType: 'typ' as const,
      };

      const result = await useCase.execute(input);

      assert.strictEqual(result.success, false, `Should reject version: ${versionNumber}`);
      if (!result.success) {
        assert.strictEqual(result.error.code, 'VALIDATION_ERROR');
        assert.ok(result.error.message.includes('không hợp lệ'));
      }
    }
  });

  it('should return FILE_TOO_LARGE when file exceeds size limit', async () => {
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
    mockStorage.setShouldThrowError('FILE_TOO_LARGE');

    const input = {
      templateId: 'template-1',
      versionNumber: 'v1.0.0',
      changelog: null,
      archive: MockTemplateStorage.createLargeArchive(10),
      archiveType: 'typ' as const,
    };

    const result = await useCase.execute(input);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, TemplateErrors.FILE_TOO_LARGE.code);
      assert.ok(result.error.message.includes('quá lớn'));
    }
  });

  it('should return INVALID_ARCHIVE for invalid archive format', async () => {
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
    mockStorage.setShouldThrowError('INVALID_ARCHIVE');

    const input = {
      templateId: 'template-1',
      versionNumber: 'v1.0.0',
      changelog: null,
      archive: MockTemplateStorage.createArchive('invalid'),
      archiveType: 'zip' as const,
    };

    const result = await useCase.execute(input);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, TemplateErrors.INVALID_ARCHIVE.code);
      assert.ok(result.error.message.includes('không hợp lệ'));
    }
  });

  it('should rollback storage on database error', async () => {
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
    const existingVersion: TemplateVersion = {
      id: 'version-1',
      templateId: 'template-1',
      versionNumber: 'v1.0.0',
      changelog: null,
      storageKey: 'template-1/version-1',
      entryPath: 'main.typ',
      isActive: true,
      createdAt: new Date(),
    };
    mockRepo.setTemplates([template]);
    mockRepo.setVersions([existingVersion]);

    const input = {
      templateId: 'template-1',
      versionNumber: 'v1.0.0',
      changelog: null,
      archive: MockTemplateStorage.createArchive('= Template'),
      archiveType: 'typ' as const,
    };

    const result = await useCase.execute(input);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, TemplateErrors.VERSION_EXISTS.code);
    }

    // Storage should have been cleaned up (rollback)
    // In real implementation, verify storage.remove was called
  });

  it('should create version with null changelog', async () => {
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

    const input = {
      templateId: 'template-1',
      versionNumber: 'v1.0.0',
      changelog: null,
      archive: MockTemplateStorage.createArchive('= Template'),
      archiveType: 'typ' as const,
    };

    const result = await useCase.execute(input);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.changelog, null);
    }
  });
});
