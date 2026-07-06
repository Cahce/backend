
import * as crypto from 'node:crypto';
import type { FileRepo } from '../domain/ProjectFile/Ports.js';
import type { File, FileKind } from '../domain/ProjectFile/Types.js';
import { StoragePolicy } from '../domain/ProjectFile/Policies.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';

export interface TemplateFile {
  path: string;
  kind: FileKind;
  content: string;
  mimeType?: string;
}

export interface CreateFilesFromTemplateCommand {
  projectId: string;
  files: TemplateFile[];
}

export class CreateFilesFromTemplateUseCase {
  constructor(private readonly fileRepo: FileRepo) {}

  async execute(command: CreateFilesFromTemplateCommand): Promise<Result<File[]>> {
    try {
      const createdFiles: File[] = [];

      for (const templateFile of command.files) {
        try {
          const sizeBytes = Buffer.byteLength(templateFile.content, 'utf8');
          const sha256 = crypto.createHash('sha256').update(templateFile.content, 'utf8').digest('hex');

          const storageMode = StoragePolicy.determineStorageMode(sizeBytes, templateFile.kind);

          const file = await this.fileRepo.create({
            projectId: command.projectId,
            path: templateFile.path,
            kind: templateFile.kind,
            content: templateFile.content,
            mimeType: templateFile.mimeType,
            storageMode,
            sizeBytes,
            sha256,
          });

          createdFiles.push(file);
        } catch (error) {
          return failure(
            'FILE_CREATION_FAILED',
            `Lỗi khi tạo tệp từ mẫu: ${templateFile.path}`,
          );
        }
      }

      return success(createdFiles);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi tạo tệp từ mẫu');
    }
  }
}
