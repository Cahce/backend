/**
 * Get Template Version File Use Case
 *
 * Resolves a version by ID, verifies it belongs to the requested template,
 * then asks the storage gateway to bundle the version directory into a .zip
 * Buffer. The route handler streams the buffer back with a Content-Disposition
 * header.
 *
 * We always return a .zip — even for the single-`.typ` upload path — so the
 * frontend can use one filename pattern and one extension.
 */

import type { TemplateRepo, TemplateStorageGateway } from '../domain/Ports.js';
import { TemplateErrors } from '../domain/Errors.js';

export interface GetTemplateVersionFileCommand {
  templateId: string;
  versionId: string;
}

export interface TemplateVersionFile {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

export type GetTemplateVersionFileResult =
  | { success: true; data: TemplateVersionFile }
  | { success: false; error: { code: string; message: string } };

const sanitizeFilenameSegment = (input: string): string =>
  input
    .replace(/[^\p{L}\p{N}\- _.]+/gu, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'template';

export class GetTemplateVersionFileUseCase {
  constructor(
    private readonly templateRepo: TemplateRepo,
    private readonly storage: TemplateStorageGateway,
  ) {}

  async execute(
    command: GetTemplateVersionFileCommand,
  ): Promise<GetTemplateVersionFileResult> {
    try {
      const version = await this.templateRepo.findVersionById(command.versionId);
      if (!version || version.templateId !== command.templateId) {
        return { success: false, error: TemplateErrors.VERSION_NOT_FOUND };
      }

      const template = await this.templateRepo.findById(command.templateId);
      if (!template) {
        return { success: false, error: TemplateErrors.TEMPLATE_NOT_FOUND };
      }

      const buffer = await this.storage.readArchive(version.storageKey);

      const filename = `${sanitizeFilenameSegment(template.name)}-${sanitizeFilenameSegment(version.versionNumber)}.zip`;

      return {
        success: true,
        data: {
          buffer,
          filename,
          contentType: 'application/zip',
        },
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'VERSION_NOT_FOUND') {
        return { success: false, error: TemplateErrors.VERSION_NOT_FOUND };
      }
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống khi đọc tệp mẫu' },
      };
    }
  }
}
