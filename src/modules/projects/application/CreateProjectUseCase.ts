/**
 * Create Project Use Case
 * 
 * Application layer orchestration for creating a new project.
 */

import { createHash } from 'node:crypto';
import type { ProjectRepo } from '../domain/Project/Ports.js';
import type { Project, CreateProjectData } from '../domain/Project/Types.js';
import { ProjectErrors } from '../domain/Project/Errors.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';
import type { MaterializeTemplate } from '../domain/MaterializeTemplate.js';
import type { FileRepo } from '../../project-files/domain/ProjectFile/Ports.js';
import { detectKindFromPath } from '../../project-files/domain/FileKindPolicy.js';
import type { ProjectSettingsRepository } from '../domain/ProjectSettingsRepository.js';
import { ProjectSettings } from '../domain/ProjectSettings.js';

/**
 * Command for creating a project
 */
export interface CreateProjectCommand {
  title: string;
  category: string;
  userId: string; // for authorization and ownership
  templateVersionId?: string; // optional template version
}

/**
 * Default scaffold used when no template is selected. Gives the user a
 * working starting point with a Typst entry file, an empty BibTeX
 * bibliography that #cite can target, and a project.toml so imports/exports
 * round-trip the project title correctly.
 */
interface ScaffoldFile {
  path: string;
  content: string;
}

function getDefaultScaffoldFiles(projectTitle: string): {
  files: ScaffoldFile[];
  entryPath: string;
} {
  const escapedTitle = projectTitle.replace(/"/g, '\\"');
  const mainTyp = `// ${projectTitle}\n//\n// Khai báo #bibliography(...) chỉ cần một lần; sau đó dùng #cite(<key>)\n// ở bất kỳ đâu để trích dẫn. Xem bibliography.bib để biết các key có sẵn.\n\n#set document(title: "${escapedTitle}")\n#set page(paper: "a4", margin: 2.5cm)\n#set text(lang: "vi", size: 12pt)\n\n= ${projectTitle}\n\nĐây là tài liệu mẫu. Hãy thay nội dung này bằng nội dung của bạn.\n\nVí dụ một trích dẫn: #cite(<sample2024>).\n\n#bibliography("bibliography.bib")\n`;
  const bibliographyBib = `@article{sample2024,\n  author  = {Nguyễn Văn A},\n  title   = {Tiêu đề bài báo mẫu},\n  journal = {Tạp chí Khoa học},\n  year    = {2024},\n  pages   = {1--10}\n}\n`;
  const projectToml = `name = "${escapedTitle}"\nentry = "main.typ"\n`;
  return {
    files: [
      { path: 'main.typ', content: mainTyp },
      { path: 'bibliography.bib', content: bibliographyBib },
      { path: 'project.toml', content: projectToml },
    ],
    entryPath: 'main.typ',
  };
}

/**
 * Create Project Use Case
 * 
 * Validates input, enforces authorization, and creates a new project.
 * If templateVersionId is provided, materializes template files into the project.
 */
export class CreateProjectUseCase {
  constructor(
    private readonly projectRepo: ProjectRepo,
    private readonly fileRepo?: FileRepo,
    private readonly settingsRepo?: ProjectSettingsRepository,
    private readonly materializeTemplate?: MaterializeTemplate,
  ) {}

  async execute(command: CreateProjectCommand): Promise<Result<Project>> {
    try {
      // Validate title is non-empty
      if (!command.title || command.title.trim().length === 0) {
        return failure(ProjectErrors.VALIDATION_ERROR.code, 'Tiêu đề dự án không được để trống');
      }

      // If templateVersionId is provided, validate dependencies first
      if (command.templateVersionId) {
        if (!this.materializeTemplate || !this.fileRepo || !this.settingsRepo) {
          console.error(`[CreateProject] Template materialization requested but dependencies missing`);
          return failure(
            'INTERNAL_ERROR',
            'Hệ thống chưa sẵn sàng để tạo dự án từ mẫu. Vui lòng thử lại sau.'
          );
        }
      }

      // Create project data
      const data: CreateProjectData = {
        title: command.title.trim(),
        category: command.category as any, // Type assertion for enum
        ownerId: command.userId,
        templateVersionId: command.templateVersionId || null,
        // templateId will be set after we get template version info
        templateId: null,
      };

      // Create project via repository
      const project = await this.projectRepo.create(data);

      // If templateVersionId is provided, materialize template files
      if (command.templateVersionId && this.materializeTemplate && this.fileRepo && this.settingsRepo) {
        try {
          console.log(`[CreateProject] Materializing template version ${command.templateVersionId}`);

          // Destructure files and entryPath from materialization result
          const { files, entryPath } = await this.materializeTemplate(command.templateVersionId);

          console.log(`[CreateProject] Materialized ${files.length} files from template with entryPath: ${entryPath}`);

          // Create files in project
          for (const file of files) {
            const content = file.content;
            const sizeBytes = Buffer.byteLength(content, 'utf-8');
            const sha256 = createHash('sha256').update(content).digest('hex');

            await this.fileRepo.create({
              projectId: project.id,
              path: file.path,
              kind: detectKindFromPath(file.path),
              content: content,
              storageMode: 'inline',
              sizeBytes,
              sha256,
            });
          }

          // Update project settings with mainPath from template's entryPath
          const settings = await this.settingsRepo.findOrCreate(project.id);
          const updatedSettings = new ProjectSettings(
            settings.projectId,
            entryPath,
            settings.compileOptions,
            settings.zoteroConfig,
            settings.openalexConfig,
            new Date(),
          );
          await this.settingsRepo.update(updatedSettings);

          console.log(`[CreateProject] Successfully materialized template for project ${project.id} with mainPath: ${entryPath}`);
        } catch (error) {
          // Check for invalid template version error by code property
          // Avoid importing templates domain error to maintain module independence
          if (error && typeof error === 'object' && 'code' in error && error.code === 'INVALID_TEMPLATE_VERSION') {
            const errorMessage = 'message' in error && typeof error.message === 'string'
              ? error.message
              : 'Phiên bản mẫu không hợp lệ hoặc không còn hoạt động';
            console.error(`[CreateProject] Invalid template version: ${errorMessage}`, error);
            return failure('INVALID_TEMPLATE_VERSION', errorMessage);
          }

          // Log unexpected errors
          console.error(`[CreateProject] Unexpected error during template materialization:`, error);
          throw error;
        }
      } else if (!command.templateVersionId && this.fileRepo && this.settingsRepo) {
        // No template selected: scaffold a minimal Typst project so the
        // workspace opens with a working main.typ + bibliography.bib +
        // project.toml. Without this, the project is empty and the user
        // has to figure out the #bibliography/#cite wiring from scratch.
        try {
          const { files, entryPath } = getDefaultScaffoldFiles(project.title);

          for (const file of files) {
            const sizeBytes = Buffer.byteLength(file.content, 'utf-8');
            const sha256 = createHash('sha256').update(file.content).digest('hex');
            await this.fileRepo.create({
              projectId: project.id,
              path: file.path,
              kind: detectKindFromPath(file.path),
              content: file.content,
              storageMode: 'inline',
              sizeBytes,
              sha256,
            });
          }

          const settings = await this.settingsRepo.findOrCreate(project.id);
          const updatedSettings = new ProjectSettings(
            settings.projectId,
            entryPath,
            settings.compileOptions,
            settings.zoteroConfig,
            settings.openalexConfig,
            new Date(),
          );
          await this.settingsRepo.update(updatedSettings);

          console.log(`[CreateProject] Scaffolded default files for project ${project.id} with mainPath: ${entryPath}`);
        } catch (error) {
          // Scaffold failure is non-fatal: project already exists, user can
          // create files manually. Log and continue so the API still returns
          // the project on a transient infra hiccup.
          console.error(`[CreateProject] Failed to scaffold default files:`, error);
        }
      }

      return success(project);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi tạo dự án');
    }
  }
}
