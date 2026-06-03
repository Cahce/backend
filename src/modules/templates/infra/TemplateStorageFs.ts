/**
 * Filesystem implementation of Template storage gateway
 * 
 * Infrastructure layer implementation of TemplateStorageGateway port.
 * Handles template file storage on local filesystem.
 * 
 * Security:
 * - Sanitizes paths to prevent path traversal attacks
 * - Validates file sizes to prevent zip bombs
 * - Rejects absolute paths and parent directory references
 * - Validates ZIP entries for path traversal
 * - Enforces size limits on individual files and total archive
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import AdmZip from 'adm-zip';
import type { TemplateStorageGateway } from '../domain/Ports.js';
import type { MaterializedFile } from '../domain/Types.js';

const MAX_SINGLE_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_ZIP_SIZE = 10 * 1024 * 1024; // 10 MB total
const MAX_ZIP_ENTRY_SIZE = 5 * 1024 * 1024; // 5 MB per file

/**
 * Filesystem-based template storage implementation
 */
export class TemplateStorageFs implements TemplateStorageGateway {
  constructor(private readonly storageRoot: string) {}

  /**
   * Write archive (single .typ or .zip) to storage
   * 
   * Supports:
   * - Single .typ files
   * - ZIP archives with multiple files
   * 
   * Security validations:
   * - Path traversal prevention
   * - Size limit enforcement
   * - main.typ requirement for ZIP
   */
  async writeArchive(input: {
    templateId: string;
    versionId: string;
    archive: AsyncIterable<Buffer>;
    archiveType: 'typ' | 'zip';
  }): Promise<{ storageKey: string; fileCount: number; entryPath: string }> {
    const storageKey = `${input.templateId}/${input.versionId}`;
    const targetDir = path.join(this.storageRoot, storageKey);

    // Ensure target directory exists
    await fs.mkdir(targetDir, { recursive: true });

    if (input.archiveType === 'typ') {
      // Single .typ file
      const targetPath = path.join(targetDir, 'main.typ');
      const chunks: Buffer[] = [];
      let totalSize = 0;

      for await (const chunk of input.archive) {
        totalSize += chunk.length;
        if (totalSize > MAX_SINGLE_FILE_SIZE) {
          // Cleanup
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
      // ZIP archive
      try {
        return await this.extractZipArchive(input.archive, targetDir);
      } catch (error) {
        // Cleanup on error
        await fs.rm(targetDir, { recursive: true, force: true });
        throw error;
      }
    }
  }

  /**
   * Write a set of already-materialized text files as a new version directory.
   *
   * Validates every path up front (reject absolute / traversal) and requires
   * `entryPath` to be present, then writes UTF-8 content. Cleans up the target
   * directory on any failure so a partial write never lingers.
   */
  async writeFiles(input: {
    templateId: string;
    versionId: string;
    files: { path: string; content: string }[];
    entryPath: string;
  }): Promise<{ storageKey: string; fileCount: number; entryPath: string }> {
    const storageKey = `${input.templateId}/${input.versionId}`;
    const targetDir = path.join(this.storageRoot, storageKey);

    // Require the entry file to exist among the provided files.
    if (!input.files.some((f) => f.path === input.entryPath)) {
      throw new Error('INVALID_ARCHIVE');
    }

    // Validate all paths BEFORE writing anything (fail fast, no partial dir).
    const resolvedRoot = path.resolve(targetDir);
    for (const file of input.files) {
      if (!file.path || path.isAbsolute(file.path)) {
        throw new Error('INVALID_ARCHIVE');
      }
      const normalized = path.normalize(file.path);
      if (normalized.startsWith('..') || normalized.includes(`..${path.sep}`)) {
        throw new Error('INVALID_ARCHIVE');
      }
      // Defense in depth: resolved target must stay inside the version dir.
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
        await fs.writeFile(targetPath, file.content, 'utf-8');
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

  /**
   * Extract ZIP archive with security validations
   */
  private async extractZipArchive(
    archive: AsyncIterable<Buffer>,
    targetDir: string,
  ): Promise<{ storageKey: string; fileCount: number; entryPath: string }> {
    // Collect archive data
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

    // Parse ZIP
    let zip: AdmZip;
    try {
      zip = new AdmZip(zipBuffer);
    } catch (error) {
      throw new Error('INVALID_ARCHIVE');
    }

    const entries = zip.getEntries();

    // Validate entries
    let hasMainTyp = false;
    let fileCount = 0;

    for (const entry of entries) {
      // Skip directories
      if (entry.isDirectory) {
        continue;
      }

      // Validate path for security
      const entryPath = entry.entryName;

      // Reject absolute paths
      if (path.isAbsolute(entryPath)) {
        throw new Error('INVALID_ARCHIVE');
      }

      // Reject path traversal attempts
      const normalizedPath = path.normalize(entryPath);
      if (normalizedPath.startsWith('..') || normalizedPath.includes('/../')) {
        throw new Error('INVALID_ARCHIVE');
      }

      // Check for main.typ at root
      if (entryPath === 'main.typ') {
        hasMainTyp = true;
      }

      // Validate file size
      if (entry.header.size > MAX_ZIP_ENTRY_SIZE) {
        throw new Error('FILE_TOO_LARGE');
      }

      fileCount++;
    }

    // Require main.typ at root
    if (!hasMainTyp) {
      throw new Error('INVALID_ARCHIVE');
    }

    // Extract files
    for (const entry of entries) {
      if (entry.isDirectory) {
        continue;
      }

      const entryPath = entry.entryName;
      const targetPath = path.join(targetDir, entryPath);

      // Ensure parent directory exists
      const parentDir = path.dirname(targetPath);
      await fs.mkdir(parentDir, { recursive: true });

      // Write file
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

  /**
   * Read all files from storage
   */
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

  /**
   * Bundle the version directory into a .zip Buffer.
   *
   * Walks the directory tree (binary-safe — uses readFile without encoding)
   * and packs every file into a zip via adm-zip. Original directory structure
   * is preserved so a re-import would produce the same template.
   *
   * Throws `Error('VERSION_NOT_FOUND')` if the storage directory is missing.
   */
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

  /**
   * Recursively add directory contents to a zip archive (binary-safe).
   */
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

  /**
   * Remove files from storage
   */
  async remove(storageKey: string): Promise<void> {
    const targetDir = path.join(this.storageRoot, storageKey);

    try {
      await fs.rm(targetDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors if directory doesn't exist
    }
  }

  /**
   * Recursively read directory and collect text files
   */
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
      } else {
        // Only read text files
        const ext = path.extname(entry.name).toLowerCase();
        if (['.typ', '.bib', '.csv', '.txt', '.md'].includes(ext)) {
          const content = await fs.readFile(fullPath, 'utf-8');
          const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
          files.push({
            path: relativePath,
            content,
          });
        }
      }
    }
  }
}
