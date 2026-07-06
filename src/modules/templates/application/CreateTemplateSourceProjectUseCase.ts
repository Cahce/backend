
import type { SourceProjectGateway, TemplateRepo } from '../domain/Ports.js';
import { TemplateErrors } from '../domain/Errors.js';

export type CreateTemplateSourceProjectInput = {
  templateId: string;
  ownerId: string;
  seed: 'blank' | 'latest';
};

export type CreateTemplateSourceProjectResult =
  | { success: true; data: { sourceProjectId: string } }
  | { success: false; error: { code: string; message: string } };

export class CreateTemplateSourceProjectUseCase {
  constructor(
    private readonly templateRepo: TemplateRepo,
    private readonly sourceProjects: SourceProjectGateway,
  ) {}

  async execute(
    input: CreateTemplateSourceProjectInput,
  ): Promise<CreateTemplateSourceProjectResult> {
    try {
      const template = await this.templateRepo.findById(input.templateId);
      if (!template) {
        return { success: false, error: TemplateErrors.TEMPLATE_NOT_FOUND };
      }

      if (template.sourceProjectId) {
        return {
          success: true,
          data: { sourceProjectId: template.sourceProjectId },
        };
      }

      let templateVersionId: string | null = null;
      if (input.seed === 'latest') {
        const versions = await this.templateRepo.listVersionsByTemplate(
          input.templateId,
        );
        const latest = versions.find((v) => v.isActive) ?? versions[0] ?? null;
        templateVersionId = latest ? latest.id : null;
      }

      const { projectId } = await this.sourceProjects.createSourceProject({
        title: template.name,
        category: template.category,
        ownerId: input.ownerId,
        templateVersionId,
      });

      await this.templateRepo.setSourceProject(input.templateId, projectId);

      return { success: true, data: { sourceProjectId: projectId } };
    } catch (error) {
      console.error('[CreateTemplateSourceProject] error:', error);
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống' },
      };
    }
  }
}
