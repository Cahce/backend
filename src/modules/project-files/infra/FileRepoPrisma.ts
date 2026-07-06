
import type { PrismaClient } from '../../../generated/prisma/index.js';
import { Prisma } from '../../../generated/prisma/index.js';
import type { FileRepo } from '../domain/ProjectFile/Ports.js';
import type { File, FileMetadata, CreateFileData, UpdateFileData, RenameFileData } from '../domain/ProjectFile/Types.js';
import { FileKind, StorageMode } from '../domain/ProjectFile/Types.js';
import { getCompilationKinds } from '../domain/FileKindPolicy.js';

export class FileRepoPrisma implements FileRepo {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    input: CreateFileData & { storageMode: string; sizeBytes: number; sha256: string },
  ): Promise<File> {
    try {
      const now = new Date();
      
      const file = await this.prisma.$transaction(async (tx) => {
        const createdFile = await tx.file.create({
          data: {
            projectId: input.projectId,
            path: input.path,
            kind: input.kind,
            textContent: input.storageMode === 'inline' ? input.content : null,
            storageKey: input.storageMode === 'object_storage' ? `${input.projectId}/${input.path}` : null,
            mimeType: input.mimeType || null,
            sizeBytes: input.sizeBytes,
            sha256: input.sha256,
            lastEditedAt: now,
          },
        });

        await tx.project.update({
          where: { id: input.projectId },
          data: { lastEditedAt: now },
        });

        return createdFile;
      });

      return this.mapToFile(file, input.storageMode as StorageMode);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('FILE_ALREADY_EXISTS');
        }
      }
      throw error;
    }
  }

  async createBinary(input: {
    projectId: string;
    path: string;
    kind: FileKind;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
  }): Promise<File> {
    try {
      const now = new Date();
      const file = await this.prisma.$transaction(async (tx) => {
        const createdFile = await tx.file.create({
          data: {
            projectId: input.projectId,
            path: input.path,
            kind: input.kind,
            textContent: null,
            storageKey: input.storageKey,
            mimeType: input.mimeType,
            sizeBytes: input.sizeBytes,
            sha256: input.sha256,
            lastEditedAt: now,
          },
        });

        await tx.project.update({
          where: { id: input.projectId },
          data: { lastEditedAt: now },
        });

        return createdFile;
      });

      return this.mapToFile(file, StorageMode.ObjectStorage);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('FILE_ALREADY_EXISTS');
        }
      }
      throw error;
    }
  }

  async findById(id: string): Promise<File | null> {
    const file = await this.prisma.file.findUnique({
      where: { id },
    });

    if (!file) {
      return null;
    }

    return this.mapToFile(file, this.determineStorageMode(file));
  }

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

  async listByProjectId(projectId: string): Promise<File[]> {
    const files = await this.prisma.file.findMany({
      where: { projectId },
      orderBy: { path: 'asc' },
    });

    return files.map((file) => this.mapToFile(file, this.determineStorageMode(file)));
  }

  async listMetadataByProjectId(projectId: string): Promise<FileMetadata[]> {
    const files = await this.prisma.file.findMany({
      where: { projectId },
      orderBy: { path: 'asc' },
      select: {
        id: true,
        projectId: true,
        path: true,
        kind: true,
        mimeType: true,
        sizeBytes: true,
        lastEditedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return files.map((file) => ({
      id: file.id,
      projectId: file.projectId,
      path: file.path,
      kind: file.kind as FileKind,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      lastEditedAt: file.lastEditedAt,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    }));
  }

  async update(
    input: UpdateFileData & { sizeBytes: number; sha256: string },
  ): Promise<File> {
    try {
      const now = new Date();
      
      const file = await this.prisma.$transaction(async (tx) => {
        const updatedFile = await tx.file.update({
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
            lastEditedAt: now,
          },
        });

        await tx.project.update({
          where: { id: input.projectId },
          data: { lastEditedAt: now },
        });

        return updatedFile;
      });

      return this.mapToFile(file, this.determineStorageMode(file));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('FILE_NOT_FOUND');
        }
      }
      throw error;
    }
  }

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
          throw new Error('FILE_NOT_FOUND');
        }
        if (error.code === 'P2002') {
          throw new Error('FILE_ALREADY_EXISTS');
        }
      }
      throw error;
    }
  }

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
          throw new Error('FILE_NOT_FOUND');
        }
      }
      throw error;
    }
  }

  async findForCompilation(projectId: string): Promise<File[]> {
    const files = await this.prisma.file.findMany({
      where: {
        projectId,
        kind: {
          in: getCompilationKinds(),
        },
      },
    });

    return files.map((file) => this.mapToFile(file, this.determineStorageMode(file)));
  }

  async exists(projectId: string, path: string): Promise<boolean> {
    const count = await this.prisma.file.count({
      where: {
        projectId,
        path,
      },
    });
    return count > 0;
  }

  private determineStorageMode(file: { textContent: string | null; storageKey: string | null }): StorageMode {
    if (file.textContent !== null) {
      return StorageMode.Inline;
    }
    if (file.storageKey !== null) {
      return StorageMode.ObjectStorage;
    }
    return StorageMode.Inline;
  }

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
