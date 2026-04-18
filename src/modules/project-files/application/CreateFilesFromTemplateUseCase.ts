/**
 * Create Files From Template Use Case
 * 
 * Application layer orchestration for creating multiple files from a template.
 */

import * as crypto from 'node:crypto';
import type { FileRepo } from '../domain/ProjectFile/Ports.js';
import type { File, FileKind } from '../domain/ProjectFile/Types.js';
import { StoragePolicy } from '../domain/ProjectFile/Policies.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';

/**
 * Template file definition
 */
export interface TemplateFile {
  path: string;
  kind: FileKind;
  content: string;
  mimeType?: string;
}

/**
 * Command for creating files from template
 */
export interface CreateFilesFromTemplateCommand {
  projectId: string;
  files: TemplateFile[];
}

/**
 * Create Files From Template Use Case
 * 
 * Creates multiple files from a template, applying storage policy to each.
 */
export class CreateFilesFromTemplateUseCase {
  constructor(private readonly FileRepo: FileRepo) {}

  async execute(command: CreateFilesFromTemplateCommand): Promise<Result<File[]>> {
    try {
      const createdFiles: File[] = [];

      for (const templateFile of command.files) {
        try {
          // Compute size and hash
          const sizeBytes = Buffer.byteLength(templateFile.content, 'utf8');
          const sha256 = crypto.createHash('sha256').update(templateFile.content, 'utf8').digest('hex');

          // Apply storage policy
          const storageMode = StoragePolicy.determineStorageMode(sizeBytes, templateFile.kind);

          // Create file via repository
          const file = await this.FileRepo.create({
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
          // Return error indicating which file failed
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
