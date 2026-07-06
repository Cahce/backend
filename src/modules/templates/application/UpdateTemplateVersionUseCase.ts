
import type { TemplateRepo } from '../domain/Ports.js';
import type { TemplateVersion } from '../domain/Types.js';
import { TemplateErrors } from '../domain/Errors.js';

export interface UpdateTemplateVersionCommand {
  versionId: string;
  patch: {
    changelog?: string | null;
    isActive?: boolean;
  };
}

export type UpdateTemplateVersionResult =
  | { success: true; data: TemplateVersion }
  | { success: false; error: { code: string; message: string } };

export class UpdateTemplateVersionUseCase {
  constructor(private readonly templateRepo: TemplateRepo) {}

  async execute(
    command: UpdateTemplateVersionCommand,
  ): Promise<UpdateTemplateVersionResult> {
    if (
      command.patch.changelog === undefined &&
      command.patch.isActive === undefined
    ) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Phải cung cấp ít nhất một trường để cập nhật',
        },
      };
    }

    try {
      const version = await this.templateRepo.updateVersion(
        command.versionId,
        command.patch,
      );
      return { success: true, data: version };
    } catch (error) {
      if (error instanceof Error && error.message === 'VERSION_NOT_FOUND') {
        return { success: false, error: TemplateErrors.VERSION_NOT_FOUND };
      }
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống' },
      };
    }
  }
}
