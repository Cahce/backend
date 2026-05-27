/**
 * Unit Tests for MaterializeTemplateVersionUseCase
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { MaterializeTemplateVersionUseCase } from '../application/MaterializeTemplateVersionUseCase.js';
import { MockTemplateRepo } from './mocks/MockTemplateRepo.js';
import { MockTemplateStorage } from './mocks/MockTemplateStorage.js';
import { type TemplateVersion } from '../domain/Types.js';
import { TemplateErrors } from '../domain/Errors.js';

describe('MaterializeTemplateVersionUseCase', () => {
  let useCase: MaterializeTemplateVersionUseCase;
  let mockRepo: MockTemplateRepo;
  let mockStorage: MockTemplateStorage;

  beforeEach(() => {
    mockRepo = new MockTemplateRepo();
    mockStorage = new MockTemplateStorage();
    useCase = new MaterializeTemplateVersionUseCase(mockRepo, mockStorage);
  });

  it('should materialize single file template successfully', async () => {
    const version: TemplateVersion = {
      id: 'version-1',
      templateId: 'template-1',
      versionNumber: 'v1.0.0',
      changelog: null,
      storageKey: 'template-1/version-1',
      entryPath: 'main.typ',
      isActive: true,
      createdAt: new Date(),
    };
    mockRepo.setVersions([version]);
    mockStorage.setFiles('template-1/version-1', [
      {
        path: 'main.typ',
        content: '= Thesis Template\n\nContent here',
      },
    ]);

    const result = await useCase.execute('version-1');

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.files.length, 1);
      assert.strictEqual(result.data.files[0].path, 'main.typ');
      assert.ok(result.data.files[0].content.includes('Thesis Template'));
      assert.strictEqual(result.data.entryPath, 'main.typ');
    }
  });

  it('should materialize multi-file template successfully', async () => {
    const version: TemplateVersion = {
      id: 'version-1',
      templateId: 'template-1',
      versionNumber: 'v1.0.0',
      changelog: null,
      storageKey: 'template-1/version-1',
      entryPath: 'main.typ',
      isActive: true,
      createdAt: new Date(),
    };
    mockRepo.setVersions([version]);
    mockStorage.setFiles('template-1/version-1', [
      {
        path: 'main.typ',
        content: '= Thesis\n\n#bibliography("refs.bib")',
      },
      {
        path: 'refs.bib',
        content: '@article{test2024}',
      },
      {
        path: 'chapters/intro.typ',
        content: '= Introduction',
      },
    ]);

    const result = await useCase.execute('version-1');

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.files.length, 3);

      const mainFile = result.data.files.find((f) => f.path === 'main.typ');
      assert.ok(mainFile);
      assert.ok(mainFile.content.includes('bibliography'));

      const bibFile = result.data.files.find((f) => f.path === 'refs.bib');
      assert.ok(bibFile);
      assert.ok(bibFile.content.includes('@article'));

      const chapterFile = result.data.files.find((f) => f.path === 'chapters/intro.typ');
      assert.ok(chapterFile);
      assert.ok(chapterFile.content.includes('Introduction'));
      
      assert.strictEqual(result.data.entryPath, 'main.typ');
    }
  });

  it('should return INVALID_TEMPLATE_VERSION when version not found', async () => {
    const result = await useCase.execute('non-existent');

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, TemplateErrors.INVALID_TEMPLATE_VERSION.code);
      assert.ok(result.error.message.includes('không hợp lệ'));
    }
  });

  it('should return INVALID_TEMPLATE_VERSION when version is inactive', async () => {
    const version: TemplateVersion = {
      id: 'version-1',
      templateId: 'template-1',
      versionNumber: 'v1.0.0',
      changelog: null,
      storageKey: 'template-1/version-1',
      entryPath: 'main.typ',
      isActive: false,
      createdAt: new Date(),
    };
    mockRepo.setVersions([version]);

    const result = await useCase.execute('version-1');

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, TemplateErrors.INVALID_TEMPLATE_VERSION.code);
      assert.ok(result.error.message.includes('không còn hoạt động'));
    }
  });

  it('should return INVALID_TEMPLATE_VERSION when storage files not found', async () => {
    const version: TemplateVersion = {
      id: 'version-1',
      templateId: 'template-1',
      versionNumber: 'v1.0.0',
      changelog: null,
      storageKey: 'template-1/version-1',
      entryPath: 'main.typ',
      isActive: true,
      createdAt: new Date(),
    };
    mockRepo.setVersions([version]);
    mockStorage.setShouldThrowError('VERSION_NOT_FOUND');

    const result = await useCase.execute('version-1');

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, TemplateErrors.INVALID_TEMPLATE_VERSION.code);
    }
  });

  it('should handle empty file list', async () => {
    const version: TemplateVersion = {
      id: 'version-1',
      templateId: 'template-1',
      versionNumber: 'v1.0.0',
      changelog: null,
      storageKey: 'template-1/version-1',
      entryPath: 'main.typ',
      isActive: true,
      createdAt: new Date(),
    };
    mockRepo.setVersions([version]);
    mockStorage.setFiles('template-1/version-1', []);

    const result = await useCase.execute('version-1');

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.files.length, 0);
      assert.strictEqual(result.data.entryPath, 'main.typ');
    }
  });

  it('should preserve file paths with subdirectories', async () => {
    const version: TemplateVersion = {
      id: 'version-1',
      templateId: 'template-1',
      versionNumber: 'v1.0.0',
      changelog: null,
      storageKey: 'template-1/version-1',
      entryPath: 'main.typ',
      isActive: true,
      createdAt: new Date(),
    };
    mockRepo.setVersions([version]);
    mockStorage.setFiles('template-1/version-1', [
      { path: 'main.typ', content: '= Main' },
      { path: 'assets/logo.typ', content: '// Logo' },
      { path: 'chapters/ch1/intro.typ', content: '= Intro' },
    ]);

    const result = await useCase.execute('version-1');

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.files.length, 3);
      assert.ok(result.data.files.find((f) => f.path === 'assets/logo.typ'));
      assert.ok(result.data.files.find((f) => f.path === 'chapters/ch1/intro.typ'));
      assert.strictEqual(result.data.entryPath, 'main.typ');
    }
  });

  it('should return custom entryPath from template version', async () => {
    const version: TemplateVersion = {
      id: 'version-1',
      templateId: 'template-1',
      versionNumber: 'v1.0.0',
      changelog: null,
      storageKey: 'template-1/version-1',
      entryPath: 'src/document.typ',
      isActive: true,
      createdAt: new Date(),
    };
    mockRepo.setVersions([version]);
    mockStorage.setFiles('template-1/version-1', [
      { path: 'src/document.typ', content: '= Document' },
      { path: 'lib/utils.typ', content: '// Utils' },
    ]);

    const result = await useCase.execute('version-1');

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.entryPath, 'src/document.typ');
      assert.strictEqual(result.data.files.length, 2);
    }
  });
});
