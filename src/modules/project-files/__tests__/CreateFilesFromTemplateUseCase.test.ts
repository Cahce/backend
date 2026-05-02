/**
 * Unit Tests for CreateFilesFromTemplateUseCase
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { CreateFilesFromTemplateUseCase, type TemplateFile } from '../application/CreateFilesFromTemplateUseCase.js';
import { MockFileRepo } from './mocks/MockFileRepo.js';
import { FileKind, StorageMode } from '../domain/ProjectFile/Types.js';

describe('CreateFilesFromTemplateUseCase', () => {
  let useCase: CreateFilesFromTemplateUseCase;
  let mockFileRepo: MockFileRepo;

  beforeEach(() => {
    mockFileRepo = new MockFileRepo();
    useCase = new CreateFilesFromTemplateUseCase(mockFileRepo);
  });

  it('should create multiple files from template successfully', async () => {
    const templateFiles: TemplateFile[] = [
      {
        path: 'main.typ',
        kind: FileKind.Typst,
        content: '#import "template.typ": *\n\n= Introduction',
        mimeType: 'text/plain',
      },
      {
        path: 'template.typ',
        kind: FileKind.Typst,
        content: '#let title(content) = text(size: 24pt, content)',
        mimeType: 'text/plain',
      },
      {
        path: 'refs.bib',
        kind: FileKind.Bib,
        content: '@article{example2024,\n  title={Example},\n}',
        mimeType: 'text/plain',
      },
    ];

    const command = {
      projectId: 'project-1',
      files: templateFiles,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.length, 3);
      assert.strictEqual(result.data[0].path, 'main.typ');
      assert.strictEqual(result.data[1].path, 'template.typ');
      assert.strictEqual(result.data[2].path, 'refs.bib');
    }
  });

  it('should compute size and hash for each file', async () => {
    const templateFiles: TemplateFile[] = [
      {
        path: 'main.typ',
        kind: FileKind.Typst,
        content: 'test content',
        mimeType: 'text/plain',
      },
    ];

    const command = {
      projectId: 'project-1',
      files: templateFiles,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      const file = result.data[0];
      assert.strictEqual(file.sizeBytes, Buffer.byteLength('test content', 'utf8'));
      assert.ok(file.sha256);
      assert.strictEqual(file.sha256.length, 64); // SHA256 hex length
    }
  });

  it('should apply storage policy to each file', async () => {
    const templateFiles: TemplateFile[] = [
      {
        path: 'main.typ',
        kind: FileKind.Typst,
        content: 'small content',
        mimeType: 'text/plain',
      },
    ];

    const command = {
      projectId: 'project-1',
      files: templateFiles,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      // Stage 1: all files should use inline storage
      assert.ok(result.data[0].storageMode);
    }
  });

  it('should handle empty template files array', async () => {
    const command = {
      projectId: 'project-1',
      files: [],
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.length, 0);
    }
  });

  it('should create files with different kinds', async () => {
    const templateFiles: TemplateFile[] = [
      {
        path: 'main.typ',
        kind: FileKind.Typst,
        content: 'typst',
        mimeType: 'text/plain',
      },
      {
        path: 'refs.bib',
        kind: FileKind.Bib,
        content: 'bib',
        mimeType: 'text/plain',
      },
      {
        path: 'data.csv',
        kind: FileKind.Data,
        content: 'csv',
        mimeType: 'text/csv',
      },
    ];

    const command = {
      projectId: 'project-1',
      files: templateFiles,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data[0].kind, FileKind.Typst);
      assert.strictEqual(result.data[1].kind, FileKind.Bib);
      assert.strictEqual(result.data[2].kind, FileKind.Data);
    }
  });

  it('should preserve mimeType for each file', async () => {
    const templateFiles: TemplateFile[] = [
      {
        path: 'main.typ',
        kind: FileKind.Typst,
        content: 'content',
        mimeType: 'text/plain',
      },
      {
        path: 'data.csv',
        kind: FileKind.Data,
        content: 'csv',
        mimeType: 'text/csv',
      },
    ];

    const command = {
      projectId: 'project-1',
      files: templateFiles,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data[0].mimeType, 'text/plain');
      assert.strictEqual(result.data[1].mimeType, 'text/csv');
    }
  });

  it('should handle files without mimeType', async () => {
    const templateFiles: TemplateFile[] = [
      {
        path: 'main.typ',
        kind: FileKind.Typst,
        content: 'content',
      },
    ];

    const command = {
      projectId: 'project-1',
      files: templateFiles,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.ok(result.data[0]);
    }
  });

  it('should return error when file creation fails', async () => {
    // Create a file that already exists
    mockFileRepo.setFiles([
      {
        id: 'existing-file',
        projectId: 'project-1',
        path: 'main.typ',
        kind: FileKind.Typst,
        storageMode: StorageMode.Inline,
        textContent: 'existing',
        storageKey: null,
        mimeType: 'text/plain',
        sizeBytes: 8,
        sha256: 'hash',
        lastEditedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const templateFiles: TemplateFile[] = [
      {
        path: 'main.typ',
        kind: FileKind.Typst,
        content: 'new content',
        mimeType: 'text/plain',
      },
    ];

    const command = {
      projectId: 'project-1',
      files: templateFiles,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, 'FILE_CREATION_FAILED');
      assert.ok(result.error.message.includes('main.typ'));
    }
  });

  it('should handle UTF-8 content in template files', async () => {
    const utf8Content = 'Tiếng Việt 中文 日本語 🎉';
    const templateFiles: TemplateFile[] = [
      {
        path: 'main.typ',
        kind: FileKind.Typst,
        content: utf8Content,
        mimeType: 'text/plain',
      },
    ];

    const command = {
      projectId: 'project-1',
      files: templateFiles,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data[0].textContent, utf8Content);
      const expectedSize = Buffer.byteLength(utf8Content, 'utf8');
      assert.strictEqual(result.data[0].sizeBytes, expectedSize);
    }
  });

  it('should create files in correct order', async () => {
    const templateFiles: TemplateFile[] = [
      {
        path: 'first.typ',
        kind: FileKind.Typst,
        content: 'first',
      },
      {
        path: 'second.typ',
        kind: FileKind.Typst,
        content: 'second',
      },
      {
        path: 'third.typ',
        kind: FileKind.Typst,
        content: 'third',
      },
    ];

    const command = {
      projectId: 'project-1',
      files: templateFiles,
    };

    const result = await useCase.execute(command);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data[0].path, 'first.typ');
      assert.strictEqual(result.data[1].path, 'second.typ');
      assert.strictEqual(result.data[2].path, 'third.typ');
    }
  });
});
