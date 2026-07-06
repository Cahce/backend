
import type { MajorRepo } from '../../domain/Major/Ports.js';
import type { FacultyRepo } from '../../domain/Faculty/Ports.js';
import type { Major, UpdateMajorData } from '../../domain/Major/Types.js';
import { MajorErrors } from '../../domain/Major/Errors.js';
import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';

export class UpdateMajorUseCase {
  constructor(
    private readonly majorRepo: MajorRepo,
    private readonly facultyRepo: FacultyRepo
  ) {}

  async execute(
    id: string,
    data: UpdateMajorData
  ): Promise<Result<Major>> {
    try {
      const existing = await this.majorRepo.findById(id);
      if (!existing) {
        const error = MajorErrors.MAJOR_NOT_FOUND;
        return failure(error.code, error.message);
      }

      if (data.facultyId && data.facultyId !== existing.facultyId) {
        const faculty = await this.facultyRepo.findById(data.facultyId);
        if (!faculty) {
          const error = MajorErrors.FACULTY_NOT_FOUND;
          return failure(error.code, error.message);
        }
      }

      if (data.code && data.code !== existing.code) {
        const duplicate = await this.majorRepo.findByCode(data.code);
        if (duplicate) {
          const error = MajorErrors.DUPLICATE_CODE;
          return failure(error.code, error.message);
        }
      }

      const major = await this.majorRepo.update(id, data);
      return success(major);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi cập nhật ngành');
    }
  }
}
