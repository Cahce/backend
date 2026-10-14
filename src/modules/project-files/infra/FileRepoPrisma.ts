
import type { PrismaClient } from '../../../generated/prisma/index.js';
import { Prisma } from '../../../generated/prisma/index.js';
import type { FileRepo } from '../domain/ProjectFile/Ports.js';
import type { File, FileMetadata, CreateFileData, UpdateFileData, RenameFileData } from '../domain/ProjectFile/Types.js';
import { FileKind, StorageMode } from '../domain/ProjectFile/Types.js';
import { getCompilationKinds } from '../domain/FileKindPolicy.js';
import { accessFor, appendProjectEvent, lockProject } from '../../projects/infra/CollaborationTransaction.js';
import { requireCondition } from '../../projects/domain/access/CollaborationErrors.js';

export class FileRepoPrisma implements FileRepo {
  constructor(private readonly prisma: PrismaClient) {}

  private async authorize(tx: Prisma.TransactionClient, projectId: string, actorId?: string) {
    await lockProject(tx, projectId);
    if (actorId) {
      const access = await accessFor(tx, projectId, { userId: actorId, role: 'student' });
      requireCondition(access.canEdit, 'PROJECT_ACCESS_DENIED', 'Bạn không có quyền chỉnh sửa dự án này');
    }
  }

  async create(
    input: CreateFileData & { storageMode: string; sizeBytes: number; sha256: string },
  ): Promise<File> {
    try {
      const now = new Date();
      
      const file = await this.prisma.$transaction(async (tx) => {
        await this.authorize(tx, input.projectId, input.actorId);
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

        await appendProjectEvent(tx, input.projectId, 'project.file.created', createdFile.id, input.actorId ?? null,
          { fileId: createdFile.id, path: createdFile.path, revision: createdFile.revision });
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
    actorId?: string;
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
        await this.authorize(tx, input.projectId, input.actorId);
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

        await appendProjectEvent(tx, input.projectId, 'project.file.created', createdFile.id, input.actorId ?? null,
          { fileId: createdFile.id, path: createdFile.path, revision: createdFile.revision });
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
        revision: true,
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
      revision: file.revision,
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
        await this.authorize(tx, input.projectId, input.actorId);
        const updatedFile = await tx.file.update({
          where: {
            ...(input.fileId ? { id: input.fileId } : {}),
            ...(input.baseRevision !== undefined ? { revision: input.baseRevision } : {}),
            projectId_path: {
              projectId: input.projectId,
              path: input.path,
            },
          },
          data: {
            revision: { increment: 1 },
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

        await appendProjectEvent(tx, input.projectId, 'project.file.updated', updatedFile.id, input.actorId ?? null,
          { fileId: updatedFile.id, path: updatedFile.path, revision: updatedFile.revision });
        return updatedFile;
      });

      return this.mapToFile(file, this.determineStorageMode(file));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          requireCondition(false, 'FILE_VERSION_CONFLICT', 'Tệp đã thay đổi. Bản nháp của bạn vẫn được giữ', 409);
        }
      }
      throw error;
    }
  }

  async rename(input: RenameFileData): Promise<File> {
    try {
      const file = await this.prisma.$transaction(async tx => {
        await this.authorize(tx, input.projectId, input.actorId);
        const updated = await tx.file.update({
        where: {
          ...(input.fileId ? { id: input.fileId } : {}),
          ...(input.baseRevision !== undefined ? { revision: input.baseRevision } : {}),
          projectId_path: {
            projectId: input.projectId,
            path: input.oldPath,
          },
        },
        data: {
          revision: { increment: 1 },
          path: input.newPath,
        },
        });
        await appendProjectEvent(tx, input.projectId, 'project.file.renamed', updated.id, input.actorId ?? null,
          { fileId: updated.id, oldPath: input.oldPath, path: updated.path, revision: updated.revision });
        return updated;
      });

      return this.mapToFile(file, this.determineStorageMode(file));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          requireCondition(false, 'FILE_VERSION_CONFLICT', 'Tệp đã thay đổi. Hãy tải lại trước khi đổi tên', 409);
        }
        if (error.code === 'P2002') {
          throw new Error('FILE_ALREADY_EXISTS');
        }
      }
      throw error;
    }
  }

  async delete(projectId: string, path: string, precondition?: { actorId: string; fileId?: string; baseRevision?: number }): Promise<void> {
    try {
      await this.prisma.$transaction(async tx => {
        await this.authorize(tx, projectId, precondition?.actorId);
        const file = await tx.file.findUnique({ where: { projectId_path: { projectId, path } } });
        requireCondition(file && (!precondition?.fileId || file.id === precondition.fileId) &&
          (precondition?.baseRevision === undefined || file.revision === precondition.baseRevision),
          'FILE_VERSION_CONFLICT', 'Tệp đã thay đổi. Hãy tải lại trước khi xóa', 409);
        await tx.projectCommentThread.updateMany({ where: { projectId, fileId: file.id }, data: { fileId: null } });
        await tx.file.delete({
        where: {
          projectId_path: {
            projectId,
            path,
          },
        },
        });
        await appendProjectEvent(tx, projectId, 'project.file.deleted', file.id, precondition?.actorId ?? null,
          { fileId: file.id, path });
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
      revision: number;
    },
    storageMode: StorageMode,
  ): File {
    return {
      revision: prismaFile.revision,
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
