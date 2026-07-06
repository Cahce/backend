import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Readable } from 'node:stream';

import { DuplicateProjectUseCase } from '../application/DuplicateProjectUseCase.js';
import { ProjectErrors } from '../domain/Project/Errors.js';
import { TemplateCategory } from '../domain/Project/Types.js';
import { ProjectSettings } from '../domain/ProjectSettings.js';
import { MockProjectRepo } from './mocks/MockProjectRepo.js';
import { MockProjectSettingsRepo } from './mocks/MockProjectSettingsRepo.js';
import { MockFileRepo } from '../../project-files/__tests__/mocks/MockFileRepo.js';
import { FileKind, StorageMode } from '../../project-files/domain/ProjectFile/Types.js';
import type { BlobMetadata, BlobStorage } from '../../../shared/storage/BlobStorage.js';
import type { ProjectAccessPolicy } from '../domain/access/ProjectAccessPolicies.js';

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

class MockBlobStorage implements BlobStorage {
  private readonly objects = new Map<string, Buffer>();

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

const allowAccess: ProjectAccessPolicy = {
  async requireProjectAccess(): Promise<void> {
  },
};

const denyAccess: ProjectAccessPolicy = {
  async requireProjectAccess(): Promise<void> {
    throw new Error('PROJECT_ACCESS_DENIED');
  },
};

describe('DuplicateProjectUseCase', () => {
  let projectRepo: MockProjectRepo;
  let fileRepo: MockFileRepo;
  let settingsRepo: MockProjectSettingsRepo;
  let blobStorage: MockBlobStorage;

  beforeEach(() => {
    projectRepo = new MockProjectRepo();
    fileRepo = new MockFileRepo();
    settingsRepo = new MockProjectSettingsRepo();
    blobStorage = new MockBlobStorage();
  });

  async function seedSource(): Promise<string> {
    const source = await projectRepo.create({
      title: 'Luận văn',
      category: TemplateCategory.Thesis,
      ownerId: 'user-1',
      templateId: 'tmpl-1',
      templateVersionId: 'ver-1',
    });
    await fileRepo.create({
      projectId: source.id,
      path: 'main.typ',
      kind: FileKind.Typst,
      content: '= Chương 1\n',
      storageMode: StorageMode.Inline,
      sizeBytes: 12,
      sha256: 'sha-main',
    });
    await blobStorage.put('orig-logo-key', Buffer.from('PNGDATA'), 'image/png');
    await fileRepo.createBinary({
      projectId: source.id,
      path: 'images/logo.png',
      kind: FileKind.Image,
      storageKey: 'orig-logo-key',
      mimeType: 'image/png',
      sizeBytes: 7,
      sha256: 'mock-sha256',
    });
    settingsRepo.setSettings(
      source.id,
      new ProjectSettings(source.id, 'main.typ', { ppi: 144 }, null, null, new Date()),
    );
    return source.id;
  }

  function makeUseCase(access: ProjectAccessPolicy): DuplicateProjectUseCase {
    return new DuplicateProjectUseCase(projectRepo, fileRepo, access, blobStorage, settingsRepo);
  }

  it('deep-copies project metadata, files, blobs and settings', async () => {
    const sourceId = await seedSource();
    const result = await makeUseCase(allowAccess).execute({
      projectId: sourceId,
      userId: 'user-1',
    });

    assert.strictEqual(result.success, true);
    if (!result.success) return;

    const copy = result.data.project;
    assert.notStrictEqual(copy.id, sourceId);
    assert.strictEqual(copy.ownerId, 'user-1');
    assert.strictEqual(copy.title, 'Luận văn (Bản sao)');
    assert.strictEqual(copy.category, TemplateCategory.Thesis);
    assert.strictEqual(copy.templateId, 'tmpl-1');
    assert.strictEqual(copy.templateVersionId, 'ver-1');

    const copiedFiles = await fileRepo.listByProjectId(copy.id);
    assert.deepStrictEqual(
      copiedFiles.map((f) => f.path).sort(),
      ['images/logo.png', 'main.typ'],
    );

    const copiedMain = await fileRepo.findByProjectIdAndPath(copy.id, 'main.typ');
    assert.strictEqual(copiedMain?.textContent, '= Chương 1\n');

    const copiedLogo = await fileRepo.findByProjectIdAndPath(copy.id, 'images/logo.png');
    assert.ok(copiedLogo?.storageKey);
    assert.notStrictEqual(copiedLogo!.storageKey, 'orig-logo-key');
    assert.ok(copiedLogo!.storageKey!.startsWith(`projects/${copy.id}/`));
    const copiedBytes = await streamToBuffer(await blobStorage.get(copiedLogo!.storageKey!));
    assert.strictEqual(copiedBytes.toString(), 'PNGDATA');

    const copiedSettings = settingsRepo.getSettings(copy.id);
    assert.strictEqual(copiedSettings?.mainPath, 'main.typ');
    assert.deepStrictEqual(copiedSettings?.compileOptions, { ppi: 144 });

    const sourceFiles = await fileRepo.listByProjectId(sourceId);
    assert.strictEqual(sourceFiles.length, 2);
  });

  it('honours a title override', async () => {
    const sourceId = await seedSource();
    const result = await makeUseCase(allowAccess).execute({
      projectId: sourceId,
      userId: 'user-1',
      title: '  Bản nháp mới  ',
    });

    assert.strictEqual(result.success, true);
    if (!result.success) return;
    assert.strictEqual(result.data.project.title, 'Bản nháp mới');
  });

  it('returns UNAUTHORIZED and creates nothing when access is denied', async () => {
    const sourceId = await seedSource();
    const result = await makeUseCase(denyAccess).execute({
      projectId: sourceId,
      userId: 'intruder',
    });

    assert.strictEqual(result.success, false);
    if (result.success) return;
    assert.strictEqual(result.error.code, ProjectErrors.UNAUTHORIZED.code);
    assert.deepStrictEqual(await projectRepo.listByOwnerId('intruder'), []);
  });

  it('returns PROJECT_NOT_FOUND when the source does not exist', async () => {
    const result = await makeUseCase(allowAccess).execute({
      projectId: 'missing',
      userId: 'user-1',
    });

    assert.strictEqual(result.success, false);
    if (result.success) return;
    assert.strictEqual(result.error.code, ProjectErrors.PROJECT_NOT_FOUND.code);
  });
});
