
import type { FacultyRepo } from '../../domain/Faculty/Ports.js';
import type { Faculty, CreateFacultyData } from '../../domain/Faculty/Types.js';
import { FacultyErrors } from '../../domain/Faculty/Errors.js';
import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';

export class CreateFacultyUseCase {
  constructor(private readonly facultyRepo: FacultyRepo) {}

  async execute(data: CreateFacultyData): Promise<Result<Faculty>> {
    try {
      const existing = await this.facultyRepo.findByCode(data.code);
      if (existing) {
        const error = FacultyErrors.DUPLICATE_CODE;
        return failure(error.code, error.message);
      }

      const faculty = await this.facultyRepo.create(data);
      return success(faculty);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi tạo khoa');
    }
  }
}
