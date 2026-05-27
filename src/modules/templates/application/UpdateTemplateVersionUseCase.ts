/**
 * Update Template Version Use Case
 *
 * Supersedes the old `DeactivateTemplateVersionUseCase`. Handles three
 * operations through a single endpoint:
 *   - activate     → patch.isActive = true
 *   - deactivate   → patch.isActive = false
 *   - edit metadata → patch.changelog = string | null
 *
 * Caller (route handler) is responsible for ensuring the validated body has
 * at least one field — Zod refinement on the DTO enforces that.
 */

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
    // Defensive: route-layer Zod already enforces "≥1 field" but the use case
    // should not silently accept a no-op write.
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
