/**
 * Mock Template Storage Gateway for Unit Testing
 * 
 * Test double that implements TemplateStorageGateway interface for isolated testing.
 */

import type { TemplateStorageGateway } from '../../domain/Ports.js';
import type { MaterializedFile } from '../../domain/Types.js';

/**
 * Mock implementation of TemplateStorageGateway for unit tests
 */
export class MockTemplateStorage implements TemplateStorageGateway {
  private storage: Map<string, MaterializedFile[]> = new Map();
  private shouldThrowError: string | null = null;

  /**
   * Configure mock to throw specific error
   */
  setShouldThrowError(error: string | null): void {
    this.shouldThrowError = error;
  }

  /**
   * Configure mock to return specific files for a storage key
   */
  setFiles(storageKey: string, files: MaterializedFile[]): void {
    this.storage.set(storageKey, files);
  }

  /**
   * Clear all mock data
   */
  clear(): void {
    this.storage.clear();
    this.shouldThrowError = null;
  }

  async writeArchive(input: {
    templateId: string;
    versionId: string;
    archive: AsyncIterable<Buffer>;
    archiveType: 'typ' | 'zip';
  }): Promise<{ storageKey: string; fileCount: number; entryPath: string }> {
    if (this.shouldThrowError) {
      throw new Error(this.shouldThrowError);
    }

    const storageKey = `${input.templateId}/${input.versionId}`;

    // Collect archive data
    const chunks: Buffer[] = [];
    let totalSize = 0;

    for await (const chunk of input.archive) {
      totalSize += chunk.length;
      chunks.push(chunk);
    }

    // Simulate file storage
    if (input.archiveType === 'typ') {
      const content = Buffer.concat(chunks).toString('utf-8');
      this.storage.set(storageKey, [
        {
          path: 'main.typ',
          content,
        },
      ]);

      return {
        storageKey,
        fileCount: 1,
        entryPath: 'main.typ',
      };
    } else {
      // For ZIP, simulate multiple files
      this.storage.set(storageKey, [
        {
          path: 'main.typ',
          content: '= Template\n\nContent from ZIP',
        },
        {
          path: 'refs.bib',
          content: '@article{test}',
        },
      ]);

      return {
        storageKey,
        fileCount: 2,
        entryPath: 'main.typ',
      };
    }
  }

  async writeFiles(input: {
    templateId: string;
    versionId: string;
    files: { path: string; content: string }[];
    entryPath: string;
  }): Promise<{ storageKey: string; fileCount: number; entryPath: string }> {
    if (this.shouldThrowError) {
      throw new Error(this.shouldThrowError);
    }

    if (!input.files.some((f) => f.path === input.entryPath)) {
      throw new Error('INVALID_ARCHIVE');
    }

    const storageKey = `${input.templateId}/${input.versionId}`;
    this.storage.set(
      storageKey,
      input.files.map((f) => ({ path: f.path, content: f.content })),
    );

    return {
      storageKey,
      fileCount: input.files.length,
      entryPath: input.entryPath,
    };
  }

  async readFiles(storageKey: string): Promise<MaterializedFile[]> {
    if (this.shouldThrowError) {
      throw new Error(this.shouldThrowError);
    }

    const files = this.storage.get(storageKey);
    if (!files) {
      throw new Error('VERSION_NOT_FOUND');
    }

    return files;
  }

  async readArchive(storageKey: string): Promise<Buffer> {
    if (this.shouldThrowError) {
      throw new Error(this.shouldThrowError);
    }
    const files = this.storage.get(storageKey);
    if (!files) {
      throw new Error('VERSION_NOT_FOUND');
    }
    // Simulate a zip by concatenating file contents with a separator. Tests
    // that need real zip semantics should use the real TemplateStorageFs
    // against a temp dir.
    const sentinel = '\n--MOCK-ZIP-ENTRY--\n';
    const blob = files
      .map((f) => `${f.path}${sentinel}${f.content}`)
      .join('\n--MOCK-ZIP-FILE--\n');
    return Buffer.from(blob, 'utf-8');
  }

  async remove(storageKey: string): Promise<void> {
    this.storage.delete(storageKey);
  }

  /**
   * Helper to create async iterable from buffer
   */
  static createArchive(content: string): AsyncIterable<Buffer> {
    return (async function* () {
      yield Buffer.from(content, 'utf-8');
    })();
  }

  /**
   * Helper to create large archive for testing size limits
   */
  static createLargeArchive(sizeInMB: number): AsyncIterable<Buffer> {
    return (async function* () {
      const chunkSize = 1024 * 1024; // 1 MB chunks
      const totalChunks = sizeInMB;
      for (let i = 0; i < totalChunks; i++) {
        yield Buffer.alloc(chunkSize, 'x');
      }
    })();
  }
}
