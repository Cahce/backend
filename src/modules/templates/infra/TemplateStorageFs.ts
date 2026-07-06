
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import AdmZip from 'adm-zip';
import type { TemplateStorageGateway } from '../domain/Ports.js';
import type { MaterializedFile } from '../domain/Types.js';

const MAX_SINGLE_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ZIP_SIZE = 10 * 1024 * 1024;
const MAX_ZIP_ENTRY_SIZE = 5 * 1024 * 1024;

function decodeUtf8Text(data: Buffer): string | null {
  const text = data.toString('utf-8');
  return text.includes('�') ? null : text;
}

export class TemplateStorageFs implements TemplateStorageGateway {
  constructor(private readonly storageRoot: string) {}

  async writeArchive(input: {
    templateId: string;
    versionId: string;
    archive: AsyncIterable<Buffer>;
    archiveType: 'typ' | 'zip';
  }): Promise<{ storageKey: string; fileCount: number; entryPath: string }> {
    const storageKey = `${input.templateId}/${input.versionId}`;
    const targetDir = path.join(this.storageRoot, storageKey);

    await fs.mkdir(targetDir, { recursive: true });

    if (input.archiveType === 'typ') {
      const targetPath = path.join(targetDir, 'main.typ');
      const chunks: Buffer[] = [];
      let totalSize = 0;

      for await (const chunk of input.archive) {
        totalSize += chunk.length;
        if (totalSize > MAX_SINGLE_FILE_SIZE) {
          await fs.rm(targetDir, { recursive: true, force: true });
          throw new Error('FILE_TOO_LARGE');
        }
        chunks.push(chunk);
      }

      await fs.writeFile(targetPath, Buffer.concat(chunks));

      return {
        storageKey,
        fileCount: 1,
        entryPath: 'main.typ',
      };
    } else {
      try {
        return await this.extractZipArchive(input.archive, targetDir);
      } catch (error) {
        await fs.rm(targetDir, { recursive: true, force: true });
        throw error;
      }
    }
  }

  async writeFiles(input: {
    templateId: string;
    versionId: string;
    files: { path: string; content: string; data?: Buffer }[];
    entryPath: string;
  }): Promise<{ storageKey: string; fileCount: number; entryPath: string }> {
    const storageKey = `${input.templateId}/${input.versionId}`;
    const targetDir = path.join(this.storageRoot, storageKey);

    if (!input.files.some((f) => f.path === input.entryPath)) {
      throw new Error('INVALID_ARCHIVE');
    }

    const resolvedRoot = path.resolve(targetDir);
    for (const file of input.files) {
      if (!file.path || path.isAbsolute(file.path)) {
        throw new Error('INVALID_ARCHIVE');
      }
      const normalized = path.normalize(file.path);
      if (normalized.startsWith('..') || normalized.includes(`..${path.sep}`)) {
        throw new Error('INVALID_ARCHIVE');
      }
      const resolvedTarget = path.resolve(targetDir, file.path);
      if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(resolvedRoot + path.sep)) {
        throw new Error('INVALID_ARCHIVE');
      }
    }

    await fs.mkdir(targetDir, { recursive: true });
    try {
      for (const file of input.files) {
        const targetPath = path.join(targetDir, file.path);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        if (file.data) {
          await fs.writeFile(targetPath, file.data);
        } else {
          await fs.writeFile(targetPath, file.content, 'utf-8');
        }
      }
    } catch (error) {
      await fs.rm(targetDir, { recursive: true, force: true });
      throw error;
    }

    return {
      storageKey,
      fileCount: input.files.length,
      entryPath: input.entryPath,
    };
  }

  private async extractZipArchive(
    archive: AsyncIterable<Buffer>,
    targetDir: string,
  ): Promise<{ storageKey: string; fileCount: number; entryPath: string }> {
    const chunks: Buffer[] = [];
    let totalSize = 0;

    for await (const chunk of archive) {
      totalSize += chunk.length;
      if (totalSize > MAX_ZIP_SIZE) {
        throw new Error('FILE_TOO_LARGE');
      }
      chunks.push(chunk);
    }

    const zipBuffer = Buffer.concat(chunks);

    let zip: AdmZip;
    try {
      zip = new AdmZip(zipBuffer);
    } catch (error) {
      throw new Error('INVALID_ARCHIVE');
    }

    const entries = zip.getEntries();

    let hasMainTyp = false;
    let fileCount = 0;

    for (const entry of entries) {
      if (entry.isDirectory) {
        continue;
      }

      const entryPath = entry.entryName;

      if (path.isAbsolute(entryPath)) {
        throw new Error('INVALID_ARCHIVE');
      }

      const normalizedPath = path.normalize(entryPath);
      if (normalizedPath.startsWith('..') || normalizedPath.includes('/../')) {
        throw new Error('INVALID_ARCHIVE');
      }

      if (entryPath === 'main.typ') {
        hasMainTyp = true;
      }

      if (entry.header.size > MAX_ZIP_ENTRY_SIZE) {
        throw new Error('FILE_TOO_LARGE');
      }

      fileCount++;
    }

    if (!hasMainTyp) {
      throw new Error('INVALID_ARCHIVE');
    }

    for (const entry of entries) {
      if (entry.isDirectory) {
        continue;
      }

      const entryPath = entry.entryName;
      const targetPath = path.join(targetDir, entryPath);

      const parentDir = path.dirname(targetPath);
      await fs.mkdir(parentDir, { recursive: true });

      const content = entry.getData();
      await fs.writeFile(targetPath, content);
    }

    const storageKey = path.relative(this.storageRoot, targetDir).replace(/\\/g, '/');

    return {
      storageKey,
      fileCount,
      entryPath: 'main.typ',
    };
  }

  async readFiles(storageKey: string): Promise<MaterializedFile[]> {
    const targetDir = path.join(this.storageRoot, storageKey);

    try {
      await fs.access(targetDir);
    } catch {
      throw new Error('VERSION_NOT_FOUND');
    }

    const files: MaterializedFile[] = [];
    await this.readDirRecursive(targetDir, targetDir, files);

    return files;
  }

  async readArchive(storageKey: string): Promise<Buffer> {
    const targetDir = path.join(this.storageRoot, storageKey);
    try {
      await fs.access(targetDir);
    } catch {
      throw new Error('VERSION_NOT_FOUND');
    }

    const zip = new AdmZip();
    await this.addDirToZip(zip, targetDir, targetDir);
    return zip.toBuffer();
  }

  private async addDirToZip(
    zip: AdmZip,
    dir: string,
    baseDir: string,
  ): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.addDirToZip(zip, fullPath, baseDir);
      } else if (entry.isFile()) {
        const data = await fs.readFile(fullPath);
        const rel = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        zip.addFile(rel, data);
      }
    }
  }

  async remove(storageKey: string): Promise<void> {
    const targetDir = path.join(this.storageRoot, storageKey);

    try {
      await fs.rm(targetDir, { recursive: true, force: true });
    } catch (error) {
    }
  }

  private async readDirRecursive(
    dir: string,
    baseDir: string,
    files: MaterializedFile[],
  ): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await this.readDirRecursive(fullPath, baseDir, files);
      } else if (entry.isFile()) {
        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        const raw = await fs.readFile(fullPath);
        const text = decodeUtf8Text(raw);
        if (text !== null) {
          files.push({ path: relativePath, content: text });
        } else {
          files.push({ path: relativePath, content: '', data: raw });
        }
      }
    }
  }
}
