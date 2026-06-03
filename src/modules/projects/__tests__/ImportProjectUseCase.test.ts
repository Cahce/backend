import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Readable } from 'node:stream';
import { crc32 } from 'node:zlib';
import AdmZip from 'adm-zip';

import { ImportProjectUseCase } from '../application/ImportProjectUseCase.js';
import { ProjectErrors } from '../domain/Project/Errors.js';
import { MockProjectRepo } from './mocks/MockProjectRepo.js';
import { MockProjectSettingsRepo } from './mocks/MockProjectSettingsRepo.js';
import { MockFileRepo } from '../../project-files/__tests__/mocks/MockFileRepo.js';
import type { BlobMetadata, BlobStorage } from '../../../shared/storage/BlobStorage.js';

class MockBlobStorage implements BlobStorage {
  private readonly objects = new Map<string, Buffer>();

  async put(key: string, body: Readable | Buffer, contentType: string): Promise<BlobMetadata> {
    const buffer = Buffer.isBuffer(body) ? body : await streamToBuffer(body);
    this.objects.set(key, buffer);
    return {
      sizeBytes: buffer.byteLength,
      sha256: 'mock-sha256',
      contentType,
    };
  }

  async get(key: string): Promise<Readable> {
    return Readable.from(this.objects.get(key) ?? Buffer.alloc(0));
  }

  async head(key: string): Promise<BlobMetadata | null> {
    const buffer = this.objects.get(key);
    if (!buffer) return null;
    return {
      sizeBytes: buffer.byteLength,
      sha256: 'mock-sha256',
      contentType: 'application/octet-stream',
    };
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function createZip(files: Record<string, string | Buffer>): Buffer {
  const zip = new AdmZip();
  for (const [filePath, content] of Object.entries(files)) {
    zip.addFile(filePath, Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8'));
  }
  return zip.toBuffer();
}

function createRawZip(filename: string, data: Buffer): Buffer {
  const nameBytes = Buffer.from(filename, 'utf-8');
  const checksum = crc32(data);

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0x21, 12);
  localHeader.writeUInt32LE(checksum, 14);
  localHeader.writeUInt32LE(data.length, 18);
  localHeader.writeUInt32LE(data.length, 22);
  localHeader.writeUInt16LE(nameBytes.length, 26);
  localHeader.writeUInt16LE(0, 28);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0, 8);
  centralHeader.writeUInt16LE(0, 10);
  centralHeader.writeUInt16LE(0, 12);
  centralHeader.writeUInt16LE(0x21, 14);
  centralHeader.writeUInt32LE(checksum, 16);
  centralHeader.writeUInt32LE(data.length, 20);
  centralHeader.writeUInt32LE(data.length, 24);
  centralHeader.writeUInt16LE(nameBytes.length, 28);
  centralHeader.writeUInt16LE(0, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  centralHeader.writeUInt32LE(0, 38);
  centralHeader.writeUInt32LE(0, 42);

  const localPart = Buffer.concat([localHeader, nameBytes, data]);
  const centralPart = Buffer.concat([centralHeader, nameBytes]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralPart.length, 12);
  eocd.writeUInt32LE(localPart.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localPart, centralPart, eocd]);
}

describe('ImportProjectUseCase', () => {
  let projectRepo: MockProjectRepo;
  let fileRepo: MockFileRepo;
  let settingsRepo: MockProjectSettingsRepo;
  let blobStorage: MockBlobStorage;
  let useCase: ImportProjectUseCase;

  beforeEach(() => {
    projectRepo = new MockProjectRepo();
    fileRepo = new MockFileRepo();
    settingsRepo = new MockProjectSettingsRepo();
    blobStorage = new MockBlobStorage();
    useCase = new ImportProjectUseCase(
      projectRepo,
      fileRepo,
      blobStorage,
      settingsRepo,
    );
  });

  it('strips a single Typst archive wrapper and persists mainPath', async () => {
    const zipBuffer = createZip({
      'templatemaudoantotnghiep/project.toml': 'name = "Do an tot nghiep"\nentry = "main.typ"\n',
      'templatemaudoantotnghiep/main.typ': '#include "chapters/Chuong3.typ"\n',
      'templatemaudoantotnghiep/chapters/Chuong3.typ': '= Chuong 3\n',
      'templatemaudoantotnghiep/bibliography.bib': '@article{sample2024}\n',
    });

    const result = await useCase.execute({ userId: 'user-1', zipBuffer });

    assert.strictEqual(result.success, true);
    if (!result.success) return;

    assert.strictEqual(result.data.project.title, 'Do an tot nghiep');

    const files = await fileRepo.listByProjectId(result.data.project.id);
    assert.deepStrictEqual(
      files.map((file) => file.path).sort(),
      ['bibliography.bib', 'chapters/Chuong3.typ', 'main.typ', 'project.toml'],
    );

    const settings = settingsRepo.getSettings(result.data.project.id);
    assert.ok(settings);
    assert.strictEqual(settings.mainPath, 'main.typ');
  });

  it('preserves root-relative zip paths that do not have a wrapper', async () => {
    const zipBuffer = createZip({
      'main.typ': '#include "chapters/intro.typ"\n',
      'chapters/intro.typ': '= Intro\n',
      'project.toml': 'name = "Root Project"\nentry = "main.typ"\n',
    });

    const result = await useCase.execute({ userId: 'user-1', zipBuffer });

    assert.strictEqual(result.success, true);
    if (!result.success) return;

    const files = await fileRepo.listByProjectId(result.data.project.id);
    assert.deepStrictEqual(
      files.map((file) => file.path).sort(),
      ['chapters/intro.typ', 'main.typ', 'project.toml'],
    );
    assert.strictEqual(settingsRepo.getSettings(result.data.project.id)?.mainPath, 'main.typ');
  });

  it('uses project.toml entry when the imported main file is custom', async () => {
    const zipBuffer = createZip({
      'template/project.toml': 'name = "Custom Entry"\nentry = "src/document.typ"\n',
      'template/src/document.typ': '= Document\n',
      'template/lib/theme.typ': '#let theme = none\n',
    });

    const result = await useCase.execute({ userId: 'user-1', zipBuffer });

    assert.strictEqual(result.success, true);
    if (!result.success) return;

    const files = await fileRepo.listByProjectId(result.data.project.id);
    assert.deepStrictEqual(
      files.map((file) => file.path).sort(),
      ['lib/theme.typ', 'project.toml', 'src/document.typ'],
    );
    assert.strictEqual(settingsRepo.getSettings(result.data.project.id)?.mainPath, 'src/document.typ');
  });

  it('preserves an ambiguous single top-level folder when no Typst marker exists', async () => {
    const zipBuffer = createZip({
      'docs/readme.txt': 'plain notes\n',
      'docs/data.csv': 'a,b\n1,2\n',
    });

    const result = await useCase.execute({ userId: 'user-1', zipBuffer });

    assert.strictEqual(result.success, true);
    if (!result.success) return;

    const files = await fileRepo.listByProjectId(result.data.project.id);
    assert.deepStrictEqual(
      files.map((file) => file.path).sort(),
      ['docs/data.csv', 'docs/readme.txt'],
    );
    assert.strictEqual(settingsRepo.getSettings(result.data.project.id), undefined);
  });

  it('rejects path traversal archive paths before creating a project', async () => {
    const zipBuffer = createRawZip('../evil.typ', Buffer.from('= Evil\n', 'utf-8'));

    const result = await useCase.execute({ userId: 'user-1', zipBuffer });

    assert.strictEqual(result.success, false);
    if (result.success) return;
    assert.strictEqual(result.error.code, ProjectErrors.ZIP_PATH_TRAVERSAL.code);
    assert.deepStrictEqual(await projectRepo.listByOwnerId('user-1'), []);
  });

  it('rejects Windows drive archive paths before creating a project', async () => {
    const zipBuffer = createZip({
      'C:/evil.typ': '= Evil\n',
    });

    const result = await useCase.execute({ userId: 'user-1', zipBuffer });

    assert.strictEqual(result.success, false);
    if (result.success) return;
    assert.strictEqual(result.error.code, ProjectErrors.ZIP_PATH_TRAVERSAL.code);
    assert.deepStrictEqual(await projectRepo.listByOwnerId('user-1'), []);
  });
});
