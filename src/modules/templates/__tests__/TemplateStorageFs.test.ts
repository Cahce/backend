
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { TemplateStorageFs } from '../infra/TemplateStorageFs.js';

describe('TemplateStorageFs — binary + non-whitelisted files', () => {
  let root: string;
  let storage: TemplateStorageFs;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'tpl-storage-'));
    storage = new TemplateStorageFs(root);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('round-trips binary assets and non-whitelisted text through writeFiles + readFiles', async () => {
    const fontBytes = Buffer.from([0x00, 0x01, 0x00, 0x00, 0xff, 0xfe, 0x42]);
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const { storageKey } = await storage.writeFiles({
      templateId: 'tpl-1',
      versionId: 'v1',
      entryPath: 'main.typ',
      files: [
        { path: 'main.typ', content: '= Thesis' },
        { path: 'project.toml', content: 'name = "x"\nentry = "main.typ"\n' },
        { path: 'Makefile', content: 'all:\n\ttypst compile main.typ\n' },
        { path: 'assets/fonts/times.ttf', content: '', data: fontBytes },
        { path: 'assets/images/logo-tlu.png', content: '', data: pngBytes },
      ],
    });

    const files = await storage.readFiles(storageKey);

    assert.strictEqual(files.length, 5);

    const toml = files.find((f) => f.path === 'project.toml');
    assert.ok(toml, 'project.toml must survive (was dropped before)');
    assert.ok(toml.content.includes('name = "x"'));
    assert.strictEqual(toml.data, undefined);

    const makefile = files.find((f) => f.path === 'Makefile');
    assert.ok(makefile, 'no-extension Makefile must survive');
    assert.ok(makefile.content.includes('typst compile'));

    const font = files.find((f) => f.path === 'assets/fonts/times.ttf');
    assert.ok(font, 'binary font must survive');
    assert.strictEqual(font.content, '');
    assert.ok(font.data && font.data.equals(fontBytes), 'font bytes must round-trip exactly');

    const png = files.find((f) => f.path === 'assets/images/logo-tlu.png');
    assert.ok(png, 'binary image must survive');
    assert.ok(png.data && png.data.equals(pngBytes), 'png bytes must round-trip exactly');
  });

  it('reads a binary file written directly to the version directory', async () => {
    const versionDir = path.join(root, 'tpl-2', 'v1');
    await fs.mkdir(path.join(versionDir, 'assets'), { recursive: true });
    await fs.writeFile(path.join(versionDir, 'main.typ'), '= Main', 'utf-8');
    const bytes = Buffer.from([0x00, 0xff, 0x10, 0x80, 0x00]);
    await fs.writeFile(path.join(versionDir, 'assets', 'logo.png'), bytes);

    const files = await storage.readFiles('tpl-2/v1');

    assert.strictEqual(files.length, 2);
    const logo = files.find((f) => f.path === 'assets/logo.png');
    assert.ok(logo && logo.data && logo.data.equals(bytes));
  });
});
