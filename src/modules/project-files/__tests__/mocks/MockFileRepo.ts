/**
 * Mock File Repository for Unit Testing
 * 
 * Test double that implements FileRepo interface for isolated testing.
 */

import type { FileRepo } from '../../domain/ProjectFile/Ports.js';
import type { File, FileKind, StorageMode } from '../../domain/ProjectFile/Types.js';

/**
 * Mock implementation of FileRepo for unit tests
 */
export class MockFileRepo implements FileRepo {
  private files: Map<string, File> = new Map();
  private nextId = 1;

  /**
   * Configure mock to return specific files
   */
  setFiles(files: File[]): void {
    this.files.clear();
    for (const file of files) {
      const key = `${file.projectId}:${file.path}`;
      this.files.set(key, file);
    }
  }

  /**
   * Clear all mock data
   */
  clear(): void {
    this.files.clear();
    this.nextId = 1;
  }

  async create(data: {
    projectId: string;
    path: string;
    kind: FileKind;
    content: string;
    mimeType?: string;
    storageMode: StorageMode;
    sizeBytes: number;
    sha256: string;
  }): Promise<File> {
    const key = `${data.projectId}:${data.path}`;
    
    // Check if file already exists
    if (this.files.has(key)) {
      throw new Error('FILE_ALREADY_EXISTS');
    }

    const id = `file-${this.nextId++}`;
    const now = new Date();
    const file: File = {
      id,
      projectId: data.projectId,
      path: data.path,
      kind: data.kind,
      storageMode: data.storageMode,
      textContent: data.storageMode === 'inline' ? data.content : null,
      storageKey: data.storageMode === 'object_storage' ? `storage/${id}` : null,
      mimeType: data.mimeType || null,
      sizeBytes: data.sizeBytes,
      sha256: data.sha256,
      lastEditedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    
    this.files.set(key, file);
    return file;
  }

  async findById(id: string): Promise<File | null> {
    for (const file of this.files.values()) {
      if (file.id === id) {
        return file;
      }
    }
    return null;
  }

  async findByProjectIdAndPath(projectId: string, path: string): Promise<File | null> {
    const key = `${projectId}:${path}`;
    return this.files.get(key) || null;
  }

  async listByProjectId(projectId: string): Promise<File[]> {
    const files = Array.from(this.files.values())
      .filter(f => f.projectId === projectId)
      .sort((a, b) => a.path.localeCompare(b.path));
    return files;
  }

  async update(data: {
    projectId: string;
    path: string;
    content: string;
    sizeBytes: number;
    sha256: string;
  }): Promise<File> {
    const key = `${data.projectId}:${data.path}`;
    const file = this.files.get(key);
    if (!file) {
      throw new Error('File not found');
    }

    const updated: File = {
      ...file,
      textContent: file.storageMode === 'inline' ? data.content : file.textContent,
      sizeBytes: data.sizeBytes,
      sha256: data.sha256,
      lastEditedAt: new Date(),
      updatedAt: new Date(),
    };

    this.files.set(key, updated);
    return updated;
  }

  async rename(data: {
    projectId: string;
    oldPath: string;
    newPath: string;
  }): Promise<File> {
    const oldKey = `${data.projectId}:${data.oldPath}`;
    const file = this.files.get(oldKey);
    if (!file) {
      throw new Error('File not found');
    }

    const renamed: File = {
      ...file,
      path: data.newPath,
      updatedAt: new Date(),
    };

    this.files.delete(oldKey);
    const newKey = `${data.projectId}:${data.newPath}`;
    this.files.set(newKey, renamed);
    return renamed;
  }

  async delete(projectId: string, path: string): Promise<void> {
    const key = `${projectId}:${path}`;
    this.files.delete(key);
  }

  async findForCompilation(projectId: string): Promise<File[]> {
    const compilationKinds = ['typst', 'bib', 'image', 'data'];
    const files = Array.from(this.files.values())
      .filter(f => f.projectId === projectId && compilationKinds.includes(f.kind));
    return files;
  }
}
