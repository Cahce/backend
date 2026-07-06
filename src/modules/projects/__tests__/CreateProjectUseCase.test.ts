
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Readable } from 'node:stream';
import { CreateProjectUseCase } from '../application/CreateProjectUseCase.js';
import { MockProjectRepo } from './mocks/MockProjectRepo.js';
import { MockProjectSettingsRepo } from './mocks/MockProjectSettingsRepo.js';
import { TemplateCategory } from '../domain/Project/Types.js';
import { ProjectErrors } from '../domain/Project/Errors.js';
import type { MaterializeTemplate } from '../domain/MaterializeTemplate.js';
import { MockFileRepo } from '../../project-files/__tests__/mocks/MockFileRepo.js';
import { StorageMode } from '../../project-files/domain/ProjectFile/Types.js';
import type { BlobMetadata, BlobStorage } from '../../../shared/storage/BlobStorage.js';

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

class MockBlobStorage implements BlobStorage {
  readonly objects = new Map<string, Buffer>();

  async put(key: string, body: Readable | Buffer, contentType: string): Promise<BlobMetadata> {
    const buffer = Buffer.isBuffer(body) ? body : await streamToBuffer(body);
    this.objects.set(key, buffer);
    return { sizeBytes: buffer.byteLength, sha256: 'mock-sha256', contentType };
  }

  async get(key: string): Promise<Readable> {
    const buf = this.objects.get(key);
    if (!buf) throw new Error(`STORAGE_NOT_FOUND: ${key}`);
    return Readable.from(buf);
  }

  async head(key: string): Promise<BlobMetadata | null> {
    const buf = this.objects.get(key);
    return buf
      ? { sizeBytes: buf.byteLength, sha256: 'mock-sha256', contentType: 'application/octet-stream' }
      : null;
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}

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

  describe('Template Materialization', () => {
    let mockFileRepo: MockFileRepo;
    let mockSettingsRepo: MockProjectSettingsRepo;
    let useCaseWithTemplate: CreateProjectUseCase;

    beforeEach(() => {
      mockRepo = new MockProjectRepo();
      mockFileRepo = new MockFileRepo();
      mockSettingsRepo = new MockProjectSettingsRepo();
    });

    it('should materialize template files with default entryPath', async () => {
      const mockMaterialize: MaterializeTemplate = async (_versionId: string) => {
        return {
          files: [
            { path: 'main.typ', content: '= Thesis Template\n\nContent here' },
            { path: 'refs.bib', content: '@article{test2024}' },
          ],
          entryPath: 'main.typ',
        };
      };

      useCaseWithTemplate = new CreateProjectUseCase(
        mockRepo,
        mockFileRepo,
        mockSettingsRepo,
        mockMaterialize,
      );

      const command = {
        title: 'My Thesis',
        category: TemplateCategory.Thesis,
        userId: 'user-123',
        templateVersionId: 'version-1',
      };

      const result = await useCaseWithTemplate.execute(command);

      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.title, 'My Thesis');

        const files = await mockFileRepo.listByProjectId(result.data.id);
        assert.strictEqual(files.length, 2);
        assert.ok(files.find((f) => f.path === 'main.typ'));
        assert.ok(files.find((f) => f.path === 'refs.bib'));

        const settings = mockSettingsRepo.getSettings(result.data.id);
        assert.ok(settings);
        assert.strictEqual(settings.mainPath, 'main.typ');
      }
    });

    it('should materialize template files with custom entryPath', async () => {
      const mockMaterialize: MaterializeTemplate = async (_versionId: string) => {
        return {
          files: [
            { path: 'src/document.typ', content: '= Document' },
            { path: 'lib/utils.typ', content: '// Utils' },
          ],
          entryPath: 'src/document.typ',
        };
      };

      useCaseWithTemplate = new CreateProjectUseCase(
        mockRepo,
        mockFileRepo,
        mockSettingsRepo,
        mockMaterialize,
      );

      const command = {
        title: 'Custom Entry Project',
        category: TemplateCategory.Thesis,
        userId: 'user-123',
        templateVersionId: 'version-2',
      };

      const result = await useCaseWithTemplate.execute(command);

      assert.strictEqual(result.success, true);
      if (result.success) {
        const files = await mockFileRepo.listByProjectId(result.data.id);
        assert.strictEqual(files.length, 2);
        assert.ok(files.find((f) => f.path === 'src/document.typ'));
        assert.ok(files.find((f) => f.path === 'lib/utils.typ'));

        const settings = mockSettingsRepo.getSettings(result.data.id);
        assert.ok(settings);
        assert.strictEqual(settings.mainPath, 'src/document.typ');
      }
    });

    it('should handle invalid template version error', async () => {
      const mockMaterialize: MaterializeTemplate = async (_versionId: string) => {
        const error = new Error('Phiên bản mẫu không hợp lệ hoặc không còn hoạt động');
        (error as any).code = 'INVALID_TEMPLATE_VERSION';
        throw error;
      };

      useCaseWithTemplate = new CreateProjectUseCase(
        mockRepo,
        mockFileRepo,
        mockSettingsRepo,
        mockMaterialize,
      );

      const command = {
        title: 'My Thesis',
        category: TemplateCategory.Thesis,
        userId: 'user-123',
        templateVersionId: 'invalid-version',
      };

      const result = await useCaseWithTemplate.execute(command);

      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.strictEqual(result.error.code, 'INVALID_TEMPLATE_VERSION');
        assert.ok(result.error.message.includes('không hợp lệ'));
      }
    });

    it('should scaffold default files when no templateVersionId provided', async () => {
      const mockMaterialize: MaterializeTemplate = async (_versionId: string) => {
        throw new Error('Should not be called');
      };

      useCaseWithTemplate = new CreateProjectUseCase(
        mockRepo,
        mockFileRepo,
        mockSettingsRepo,
        mockMaterialize,
      );

      const command = {
        title: 'Empty Project',
        category: TemplateCategory.Thesis,
        userId: 'user-123',
      };

      const result = await useCaseWithTemplate.execute(command);

      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.title, 'Empty Project');

        const files = await mockFileRepo.listByProjectId(result.data.id);
        assert.strictEqual(files.length, 3);
        assert.ok(files.find((f) => f.path === 'main.typ'));
        assert.ok(files.find((f) => f.path === 'bibliography.bib'));
        assert.ok(files.find((f) => f.path === 'project.toml'));

        const settings = mockSettingsRepo.getSettings(result.data.id);
        assert.ok(settings);
        assert.strictEqual(settings.mainPath, 'main.typ');
      }
    });

    it('should handle materialization with empty file list', async () => {
      const mockMaterialize: MaterializeTemplate = async (_versionId: string) => {
        return {
          files: [],
          entryPath: 'main.typ',
        };
      };

      useCaseWithTemplate = new CreateProjectUseCase(
        mockRepo,
        mockFileRepo,
        mockSettingsRepo,
        mockMaterialize,
      );

      const command = {
        title: 'Empty Template',
        category: TemplateCategory.Thesis,
        userId: 'user-123',
        templateVersionId: 'empty-version',
      };

      const result = await useCaseWithTemplate.execute(command);

      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.title, 'Empty Template');

        const files = await mockFileRepo.listByProjectId(result.data.id);
        assert.strictEqual(files.length, 0);

        const settings = mockSettingsRepo.getSettings(result.data.id);
        assert.ok(settings);
        assert.strictEqual(settings.mainPath, 'main.typ');
      }
    });

    it('should persist binary template assets (fonts/images) to blob storage', async () => {
      const fontBytes = Buffer.from([0x00, 0x01, 0x00, 0x00, 0xff, 0xfe]);
      const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const mockMaterialize: MaterializeTemplate = async (_versionId: string) => ({
        files: [
          { path: 'main.typ', content: '= Thesis' },
          { path: 'assets/fonts/times.ttf', content: '', data: fontBytes },
          { path: 'assets/images/logo-tlu.png', content: '', data: pngBytes },
        ],
        entryPath: 'main.typ',
      });

      const blobStorage = new MockBlobStorage();
      useCaseWithTemplate = new CreateProjectUseCase(
        mockRepo,
        mockFileRepo,
        mockSettingsRepo,
        mockMaterialize,
        blobStorage,
      );

      const result = await useCaseWithTemplate.execute({
        title: 'Thesis with assets',
        category: TemplateCategory.Thesis,
        userId: 'user-123',
        templateVersionId: 'version-assets',
      });

      assert.strictEqual(result.success, true);
      if (result.success) {
        const files = await mockFileRepo.listByProjectId(result.data.id);
        assert.strictEqual(files.length, 3);

        const main = files.find((f) => f.path === 'main.typ');
        assert.ok(main);
        assert.strictEqual(main.storageMode, StorageMode.Inline);
        assert.strictEqual(main.textContent, '= Thesis');

        const font = files.find((f) => f.path === 'assets/fonts/times.ttf');
        assert.ok(font, 'font file should be materialized');
        assert.strictEqual(font.storageMode, StorageMode.ObjectStorage);
        assert.ok(font.storageKey);
        assert.strictEqual(font.textContent, null);

        const png = files.find((f) => f.path === 'assets/images/logo-tlu.png');
        assert.ok(png, 'image file should be materialized');
        assert.strictEqual(png.storageMode, StorageMode.ObjectStorage);
        assert.ok(png.storageKey);

        assert.strictEqual(blobStorage.objects.size, 2);
        const storedFont = blobStorage.objects.get(font.storageKey as string);
        assert.ok(storedFont && storedFont.equals(fontBytes));
      }
    });

    it('should preserve file paths with subdirectories', async () => {
      const mockMaterialize: MaterializeTemplate = async (_versionId: string) => {
        return {
          files: [
            { path: 'main.typ', content: '= Main' },
            { path: 'assets/logo.typ', content: '// Logo' },
            { path: 'chapters/ch1/intro.typ', content: '= Intro' },
          ],
          entryPath: 'main.typ',
        };
      };

      useCaseWithTemplate = new CreateProjectUseCase(
        mockRepo,
        mockFileRepo,
        mockSettingsRepo,
        mockMaterialize,
      );

      const command = {
        title: 'Multi-level Project',
        category: TemplateCategory.Thesis,
        userId: 'user-123',
        templateVersionId: 'version-3',
      };

      const result = await useCaseWithTemplate.execute(command);

      assert.strictEqual(result.success, true);
      if (result.success) {
        const files = await mockFileRepo.listByProjectId(result.data.id);
        assert.strictEqual(files.length, 3);
        assert.ok(files.find((f) => f.path === 'main.typ'));
        assert.ok(files.find((f) => f.path === 'assets/logo.typ'));
        assert.ok(files.find((f) => f.path === 'chapters/ch1/intro.typ'));
      }
    });
  });
});
