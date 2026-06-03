/**
 * Import Template Source Project Use Case
 *
 * Creates an admin-owned "source project" seeded from an uploaded .zip and
 * links it to the template via `Template.sourceProjectId`. The actual zip
 * import is delegated to the projects module through `SourceProjectGateway`.
 */

import type { SourceProjectGateway, TemplateRepo } from '../domain/Ports.js';
import { TemplateErrors } from '../domain/Errors.js';

export type ImportTemplateSourceProjectInput = {
  templateId: string;
  ownerId: string;
  zipBuffer: Buffer;
};

export type ImportTemplateSourceProjectResult =
  | { success: true; data: { sourceProjectId: string } }
  | { success: false; error: { code: string; message: string } };

export class ImportTemplateSourceProjectUseCase {
  constructor(
    private readonly templateRepo: TemplateRepo,
    private readonly sourceProjects: SourceProjectGateway,
  ) {}

  async execute(
    input: ImportTemplateSourceProjectInput,
  ): Promise<ImportTemplateSourceProjectResult> {
    try {
      const template = await this.templateRepo.findById(input.templateId);
      if (!template) {
        return { success: false, error: TemplateErrors.TEMPLATE_NOT_FOUND };
      }

      let projectId: string;
      try {
        const res = await this.sourceProjects.importSourceProject({
          ownerId: input.ownerId,
          zipBuffer: input.zipBuffer,
        });
        projectId = res.projectId;
      } catch (error) {
        // The gateway surfaces projects-module zip errors via a `code`.
        const code = (error as { code?: string }).code;
        if (code === 'ZIP_MALFORMED' || code === 'ZIP_PATH_TRAVERSAL') {
          return { success: false, error: TemplateErrors.INVALID_ARCHIVE };
        }
        if (code === 'ZIP_PAYLOAD_TOO_LARGE') {
          return { success: false, error: TemplateErrors.FILE_TOO_LARGE };
        }
        throw error;
      }

      await this.templateRepo.setSourceProject(input.templateId, projectId);

      return { success: true, data: { sourceProjectId: projectId } };
    } catch (error) {
      console.error('[ImportTemplateSourceProject] error:', error);
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống' },
      };
    }
  }
}
