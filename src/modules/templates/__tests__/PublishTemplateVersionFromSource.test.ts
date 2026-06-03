/**
 * Unit Tests for PublishTemplateVersionFromSourceUseCase
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { PublishTemplateVersionFromSourceUseCase } from '../application/PublishTemplateVersionFromSourceUseCase.js';
import { MockTemplateRepo } from './mocks/MockTemplateRepo.js';
import { MockTemplateStorage } from './mocks/MockTemplateStorage.js';
import { TemplateCategory, type Template } from '../domain/Types.js';
import type { SourceProjectGateway } from '../domain/Ports.js';

function makeTemplate(overrides: Partial<Template> = {}): Template {
  const now = new Date();
  return {
    id: 'template-1',
    name: 'Test Template',
    description: null,
    category: TemplateCategory.Thesis,
    isOfficial: false,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    sourceProjectId: 'proj-1',
    ...overrides,
  };
}

function makeGateway(
  files: { path: string; content: string }[],
  entryPath = 'main.typ',
): SourceProjectGateway {
  return {
    async createSourceProject() {
      return { projectId: 'proj-new', mainPath: 'main.typ' };
    },
    async importSourceProject() {
      return { projectId: 'proj-imp', mainPath: 'main.typ' };
    },
    async readSourceProjectFiles() {
      return { files, entryPath };
    },
  };
}

describe('PublishTemplateVersionFromSourceUseCase', () => {
  let mockRepo: MockTemplateRepo;
  let mockStorage: MockTemplateStorage;

  beforeEach(() => {
    mockRepo = new MockTemplateRepo();
    mockStorage = new MockTemplateStorage();
  });

  it('publishes a new version from the source project files', async () => {
    mockRepo.setTemplates([makeTemplate()]);
    const gateway = makeGateway([
      { path: 'main.typ', content: '= Hello' },
      { path: 'bibliography.bib', content: '@article{a}' },
    ]);
    const useCase = new PublishTemplateVersionFromSourceUseCase(
      mockRepo,
      mockStorage,
      gateway,
    );

    const result = await useCase.execute({
      templateId: 'template-1',
      versionNumber: 'v1.0.0',
      changelog: 'init',
    });

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.versionNumber, 'v1.0.0');
      assert.strictEqual(result.data.entryPath, 'main.typ');
      assert.ok(result.data.storageKey);
      const stored = await mockStorage.readFiles(result.data.storageKey);
      assert.strictEqual(stored.length, 2);
    }
  });

  it('rejects an invalid version number', async () => {
    mockRepo.setTemplates([makeTemplate()]);
    const useCase = new PublishTemplateVersionFromSourceUseCase(
      mockRepo,
      mockStorage,
      makeGateway([{ path: 'main.typ', content: '= Hi' }]),
    );

    const result = await useCase.execute({
      templateId: 'template-1',
      versionNumber: 'not-a-version',
      changelog: null,
    });

    assert.strictEqual(result.success, false);
    if (!result.success) assert.strictEqual(result.error.code, 'VALIDATION_ERROR');
  });

  it('fails when the template has no source project', async () => {
    mockRepo.setTemplates([makeTemplate({ sourceProjectId: null })]);
    const useCase = new PublishTemplateVersionFromSourceUseCase(
      mockRepo,
      mockStorage,
      makeGateway([{ path: 'main.typ', content: '= Hi' }]),
    );

    const result = await useCase.execute({
      templateId: 'template-1',
      versionNumber: 'v1.0.0',
      changelog: null,
    });

    assert.strictEqual(result.success, false);
    if (!result.success)
      assert.strictEqual(result.error.code, 'SOURCE_PROJECT_MISSING');
  });

  it('fails with VERSION_EXISTS on a duplicate version number', async () => {
    mockRepo.setTemplates([makeTemplate()]);
    const useCase = new PublishTemplateVersionFromSourceUseCase(
      mockRepo,
      mockStorage,
      makeGateway([{ path: 'main.typ', content: '= Hi' }]),
    );

    await useCase.execute({
      templateId: 'template-1',
      versionNumber: 'v1.0.0',
      changelog: null,
    });
    const dup = await useCase.execute({
      templateId: 'template-1',
      versionNumber: 'v1.0.0',
      changelog: null,
    });

    assert.strictEqual(dup.success, false);
    if (!dup.success) assert.strictEqual(dup.error.code, 'VERSION_EXISTS');
  });

  it('fails with INVALID_ARCHIVE when the entry file is missing', async () => {
    mockRepo.setTemplates([makeTemplate()]);
    const useCase = new PublishTemplateVersionFromSourceUseCase(
      mockRepo,
      mockStorage,
      makeGateway([{ path: 'other.typ', content: '= Hi' }], 'main.typ'),
    );

    const result = await useCase.execute({
      templateId: 'template-1',
      versionNumber: 'v1.0.0',
      changelog: null,
    });

    assert.strictEqual(result.success, false);
    if (!result.success) assert.strictEqual(result.error.code, 'INVALID_ARCHIVE');
  });
});
