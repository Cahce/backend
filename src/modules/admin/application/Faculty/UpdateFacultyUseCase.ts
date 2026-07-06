
import type { FacultyRepo } from '../../domain/Faculty/Ports.js';
import type { Faculty, UpdateFacultyData } from '../../domain/Faculty/Types.js';
import { FacultyErrors } from '../../domain/Faculty/Errors.js';
import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';

export class UpdateFacultyUseCase {
  constructor(private readonly facultyRepo: FacultyRepo) {}

  async execute(id: string, data: UpdateFacultyData): Promise<Result<Faculty>> {
    try {
      const existing = await this.facultyRepo.findById(id);
      if (!existing) {
        const error = FacultyErrors.FACULTY_NOT_FOUND;
        return failure(error.code, error.message);
      }

      if (data.code && data.code !== existing.code) {
        const duplicate = await this.facultyRepo.findByCode(data.code);
        if (duplicate) {
          const error = FacultyErrors.DUPLICATE_CODE;
          return failure(error.code, error.message);
        }
      }

      const faculty = await this.facultyRepo.update(id, data);
      return success(faculty);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi cập nhật khoa');
    }
  }
}
