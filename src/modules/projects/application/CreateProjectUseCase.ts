import { createHash, randomUUID } from 'node:crypto';
import type { ProjectRepo } from '../domain/Project/Ports.js';
import type { Project, CreateProjectData } from '../domain/Project/Types.js';
import { ProjectErrors } from '../domain/Project/Errors.js';
import type { Result } from './Types.js';
import { success, failure } from './Types.js';
import type { MaterializeTemplate } from '../domain/MaterializeTemplate.js';
import type { FileRepo } from '../../project-files/domain/ProjectFile/Ports.js';
import {
  detectKindFromPath,
  getMimeTypeForKind,
} from '../../project-files/domain/FileKindPolicy.js';
import type { ProjectSettingsRepository } from '../domain/ProjectSettingsRepository.js';
import { ProjectSettings } from '../domain/ProjectSettings.js';
import type { BlobStorage } from '../../../shared/storage/BlobStorage.js';

export interface CreateProjectCommand {
  title: string;
  category: string;
  userId: string;
  templateVersionId?: string;
}

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

export class CreateProjectUseCase {
  constructor(
    private readonly projectRepo: ProjectRepo,
    private readonly fileRepo?: FileRepo,
    private readonly settingsRepo?: ProjectSettingsRepository,
    private readonly materializeTemplate?: MaterializeTemplate,
    private readonly blobStorage?: BlobStorage,
  ) { }

  async execute(command: CreateProjectCommand): Promise<Result<Project>> {
    try {
      if (!command.title || command.title.trim().length === 0) {
        return failure(ProjectErrors.VALIDATION_ERROR.code, 'Tiêu đề dự án không được để trống');
      }

      if (command.templateVersionId) {
        if (!this.materializeTemplate || !this.fileRepo || !this.settingsRepo) {
          console.error(`[CreateProject] Template materialization requested but dependencies missing`);
          return failure(
            'INTERNAL_ERROR',
            'Hệ thống chưa sẵn sàng để tạo dự án từ mẫu. Vui lòng thử lại sau.'
          );
        }
      }

      const data: CreateProjectData = {
        title: command.title.trim(),
        category: command.category as any,
        ownerId: command.userId,
        templateVersionId: command.templateVersionId || null,
        templateId: null,
      };

      const project = await this.projectRepo.create(data);

      if (command.templateVersionId && this.materializeTemplate && this.fileRepo && this.settingsRepo) {
        try {
          console.log(`[CreateProject] Materializing template version ${command.templateVersionId}`);

          const { files, entryPath } = await this.materializeTemplate(command.templateVersionId);

          console.log(`[CreateProject] Materialized ${files.length} files from template with entryPath: ${entryPath}`);

          for (const file of files) {
            const kind = detectKindFromPath(file.path);

            if (file.data) {
              if (!this.blobStorage) {
                console.warn(
                  `[CreateProject] Skipping binary template file (no blob storage): ${file.path}`,
                );
                continue;
              }
              const ext = file.path.toLowerCase().split('.').pop() ?? '';
              const mimeType = getMimeTypeForKind(kind, ext);
              const storageKey = `projects/${project.id}/${randomUUID()}-${file.path
                .split('/')
                .pop()}`;
              const meta = await this.blobStorage.put(storageKey, file.data, mimeType);
              await this.fileRepo.createBinary({
                projectId: project.id,
                path: file.path,
                kind,
                storageKey,
                mimeType: meta.contentType,
                sizeBytes: meta.sizeBytes,
                sha256: meta.sha256,
              });
            } else {
              const content = file.content;
              const sizeBytes = Buffer.byteLength(content, 'utf-8');
              const sha256 = createHash('sha256').update(content).digest('hex');

              await this.fileRepo.create({
                projectId: project.id,
                path: file.path,
                kind,
                content: content,
                storageMode: 'inline',
                sizeBytes,
                sha256,
              });
            }
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

          console.log(`[CreateProject] Successfully materialized template for project ${project.id} with mainPath: ${entryPath}`);
        } catch (error) {
          if (error && typeof error === 'object' && 'code' in error && error.code === 'INVALID_TEMPLATE_VERSION') {
            const errorMessage = 'message' in error && typeof error.message === 'string'
              ? error.message
              : 'Phiên bản mẫu không hợp lệ hoặc không còn hoạt động';
            console.error(`[CreateProject] Invalid template version: ${errorMessage}`, error);
            return failure('INVALID_TEMPLATE_VERSION', errorMessage);
          }

          console.error(`[CreateProject] Unexpected error during template materialization:`, error);
          throw error;
        }
      } else if (!command.templateVersionId && this.fileRepo && this.settingsRepo) {
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
          console.error(`[CreateProject] Failed to scaffold default files:`, error);
        }
      }

      return success(project);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi tạo dự án');
    }
  }
}
