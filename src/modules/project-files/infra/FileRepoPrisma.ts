/**
 * Prisma implementation of File repository
 * 
 * Infrastructure layer implementation of FileRepo port.
 * Handles all File data access operations using Prisma.
 */

import type { PrismaClient } from '../../../generated/prisma/index.js';
import { Prisma } from '../../../generated/prisma/index.js';
import type { FileRepo } from '../domain/ProjectFile/Ports.js';
import type { File, CreateFileData, UpdateFileData, RenameFileData } from '../domain/ProjectFile/Types.js';
import { FileKind, StorageMode } from '../domain/ProjectFile/Types.js';

/**
 * Prisma-based File repository implementation
 */
export class FileRepoPrisma implements FileRepo {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new File
   */
  async create(
    input: CreateFileData & { storageMode: string; sizeBytes: number; sha256: string },
  ): Promise<File> {
    try {
      const file = await this.prisma.file.create({
        data: {
          projectId: input.projectId,
          path: input.path,
          kind: input.kind,
          textContent: input.storageMode === 'inline' ? input.content : null,
          storageKey: input.storageMode === 'object_storage' ? `${input.projectId}/${input.path}` : null,
          mimeType: input.mimeType || null,
          sizeBytes: input.sizeBytes,
          sha256: input.sha256,
          lastEditedAt: new Date(),
        },
      });

      return this.mapToFile(file, input.storageMode as StorageMode);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Unique constraint violation - file already exists at path
          throw new Error('FILE_ALREADY_EXISTS');
        }
      }
      throw error;
    }
  }

  /**
   * Find File by ID
   */
  async findById(id: string): Promise<File | null> {
    const file = await this.prisma.file.findUnique({
      where: { id },
    });

    if (!file) {
      return null;
    }

    return this.mapToFile(file, this.determineStorageMode(file));
  }

  /**
   * Find File by project ID and path
   */
  async findByProjectIdAndPath(projectId: string, path: string): Promise<File | null> {
    const file = await this.prisma.file.findUnique({
      where: {
        projectId_path: {
          projectId,
          path,
        },
      },
    });

    if (!file) {
      return null;
    }

    return this.mapToFile(file, this.determineStorageMode(file));
  }

  /**
   * List all Files in a project
   * Results are ordered by path alphabetically
   */
  async listByProjectId(projectId: string): Promise<File[]> {
    const files = await this.prisma.file.findMany({
      where: { projectId },
      orderBy: { path: 'asc' },
    });

    return files.map((file) => this.mapToFile(file, this.determineStorageMode(file)));
  }

  /**
   * Update an existing File
   */
  async update(
    input: UpdateFileData & { sizeBytes: number; sha256: string },
  ): Promise<File> {
    try {
      const file = await this.prisma.file.update({
        where: {
          projectId_path: {
            projectId: input.projectId,
            path: input.path,
          },
        },
        data: {
          textContent: input.content,
          sizeBytes: input.sizeBytes,
          sha256: input.sha256,
          lastEditedAt: new Date(),
        },
      });

      return this.mapToFile(file, this.determineStorageMode(file));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          // Record not found
          throw new Error('FILE_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  /**
   * Rename a File
   */
  async rename(input: RenameFileData): Promise<File> {
    try {
      const file = await this.prisma.file.update({
        where: {
          projectId_path: {
            projectId: input.projectId,
            path: input.oldPath,
          },
        },
        data: {
          path: input.newPath,
        },
      });

      return this.mapToFile(file, this.determineStorageMode(file));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          // Record not found
          throw new Error('FILE_NOT_FOUND');
        }
        if (error.code === 'P2002') {
          // Unique constraint violation - file already exists at newPath
          throw new Error('FILE_ALREADY_EXISTS');
        }
      }
      throw error;
    }
  }

  /**
   * Delete a File
   */
  async delete(projectId: string, path: string): Promise<void> {
    try {
      await this.prisma.file.delete({
        where: {
          projectId_path: {
            projectId,
            path,
          },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          // Record not found
          throw new Error('FILE_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  /**
   * Find files for compilation
   * Returns files with kind: typst, bib, image, or data
   */
  async findForCompilation(projectId: string): Promise<File[]> {
    const files = await this.prisma.file.findMany({
      where: {
        projectId,
        kind: {
          in: ['typst', 'bib', 'image', 'data'],
        },
      },
    });

    return files.map((file) => this.mapToFile(file, this.determineStorageMode(file)));
  }

  /**
   * Determine storage mode from Prisma file record
   */
  private determineStorageMode(file: { textContent: string | null; storageKey: string | null }): StorageMode {
    if (file.textContent !== null) {
      return StorageMode.Inline;
    }
    if (file.storageKey !== null) {
      return StorageMode.ObjectStorage;
    }
    // Default to inline if both are null (shouldn't happen in practice)
    return StorageMode.Inline;
  }

  /**
   * Map Prisma File model to domain File type
   */
  private mapToFile(
    prismaFile: {
      id: string;
      projectId: string;
      path: string;
      kind: string;
      textContent: string | null;
      storageKey: string | null;
      mimeType: string | null;
      sizeBytes: number | null;
      sha256: string | null;
      lastEditedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
    storageMode: StorageMode,
  ): File {
    return {
      id: prismaFile.id,
      projectId: prismaFile.projectId,
      path: prismaFile.path,
      kind: prismaFile.kind as FileKind,
      storageMode,
      textContent: prismaFile.textContent,
      storageKey: prismaFile.storageKey,
      mimeType: prismaFile.mimeType,
      sizeBytes: prismaFile.sizeBytes,
      sha256: prismaFile.sha256,
      lastEditedAt: prismaFile.lastEditedAt,
      createdAt: prismaFile.createdAt,
      updatedAt: prismaFile.updatedAt,
    };
  }
}
